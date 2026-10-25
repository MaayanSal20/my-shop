import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { products, orders } from '../db/schema';
import { expireOldOrders } from '../app';
import { markOrderPaid } from '../payments/markPaid';
import { createProduct, createUser, loginAs, SHIPPING } from './helpers';

async function pendingOrder(stock = 5, quantity = 2, price = 100) {
  const p = await createProduct({ stock, price });
  await createUser('buyer@test.dev');
  const agent = await loginAs('buyer@test.dev');
  await agent.post('/api/cart/items').send({ productId: p.id, quantity });
  const { body } = await agent.post('/api/checkout').send(SHIPPING);
  return { productId: p.id, orderId: body.id as number, total: body.total as number };
}

const orderRow = async (id: number) => (await db.select().from(orders).where(eq(orders.id, id)))[0];
const stockOf = async (id: number) =>
  (await db.select().from(products).where(eq(products.id, id)))[0].stock;

async function expire(orderId: number) {
  await db.update(orders).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(orders.id, orderId));
  await expireOldOrders();
}

describe('סימון הזמנה כשולמה', () => {
  it('מסמן הזמנה ממתינה כשולמה', async () => {
    const { orderId, total } = await pendingOrder();
    expect(await markOrderPaid(orderId, total, 'ref1')).toBe('paid');
    const o = await orderRow(orderId);
    expect(o.status).toBe('paid');
    expect(o.paidAt).not.toBeNull();
    expect(o.gatewayRef).toBe('ref1');
  });

  it('קריאה כפולה לא משנה כלום', async () => {
    const { orderId, total, productId } = await pendingOrder();
    await markOrderPaid(orderId, total, 'ref1');
    const stockAfterFirst = await stockOf(productId);

    expect(await markOrderPaid(orderId, total, 'ref2')).toBe('already_paid');
    expect(await stockOf(productId)).toBe(stockAfterFirst);
    expect((await orderRow(orderId)).gatewayRef).toBe('ref1');
  });

  it('שתי קריאות במקביל מסמנות פעם אחת בלבד', async () => {
    const { orderId, total } = await pendingOrder();
    const results = await Promise.all([
      markOrderPaid(orderId, total, 'a'),
      markOrderPaid(orderId, total, 'b'),
    ]);
    expect(results.sort()).toEqual(['already_paid', 'paid']);
  });

  it('סכום שגוי נדחה וההזמנה נשארת ממתינה', async () => {
    const { orderId, total } = await pendingOrder();
    expect(await markOrderPaid(orderId, total - 1, 'ref')).toBe('amount_mismatch');
    expect((await orderRow(orderId)).status).toBe('pending');
  });

  it('הזמנה שלא קיימת', async () => {
    expect(await markOrderPaid(999, 100, 'ref')).toBe('not_found');
  });

  it('תשלום מאוחר אחרי פקיעה: שומר מלאי מחדש כשיש', async () => {
    const { orderId, total, productId } = await pendingOrder(5, 2);
    await expire(orderId);
    expect(await stockOf(productId)).toBe(5);

    expect(await markOrderPaid(orderId, total, 'late')).toBe('paid');
    expect(await stockOf(productId)).toBe(3);
    expect((await orderRow(orderId)).status).toBe('paid');
  });

  it('תשלום מאוחר כשהמלאי אזל: נדרש החזר והמלאי לא משתנה', async () => {
    const { orderId, total, productId } = await pendingOrder(5, 2);
    await expire(orderId);
    await db.update(products).set({ stock: 0 }).where(eq(products.id, productId));

    expect(await markOrderPaid(orderId, total, 'late')).toBe('needs_refund');
    expect(await stockOf(productId)).toBe(0);
    expect((await orderRow(orderId)).status).toBe('expired');
  });
});