import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { products, orders } from '../db/schema';
import { expireOldOrders } from '../app';
import { createProduct, createUser, loginAs, SHIPPING } from './helpers';

async function stockOf(id: number) {
  const [p] = await db.select().from(products).where(eq(products.id, id));
  return p.stock;
}

async function buyerWithCart(productId: number, quantity: number, verified = true) {
  await createUser('buyer@test.dev', 'customer', verified);
  const agent = await loginAs('buyer@test.dev');
  await agent.post('/api/cart/items').send({ productId, quantity });
  return agent;
}

describe('מלאי', () => {
  it('צ׳קאאוט שומר מלאי ומרוקן את הסל', async () => {
    const p = await createProduct({ stock: 5, price: 100 });
    const agent = await buyerWithCart(p.id, 2);

    const res = await agent.post('/api/checkout').send(SHIPPING);
    expect(res.status).toBe(201);
    expect(await stockOf(p.id)).toBe(3);
    expect((await agent.get('/api/cart')).body).toEqual([]);
  });

  it('הסכום נקבע בשרת ולא לפי מה שהלקוח שולח', async () => {
    const p = await createProduct({ stock: 5, price: 100 });
    const agent = await buyerWithCart(p.id, 2);

    const res = await agent.post('/api/checkout').send({ ...SHIPPING, total: 1, price: 1 });
    expect(res.body.total).toBe(200);
  });

  it('אין מלאי מספיק: ההזמנה נכשלת והמלאי לא משתנה', async () => {
    const p = await createProduct({ stock: 5 });
    const agent = await buyerWithCart(p.id, 3);
    await db.update(products).set({ stock: 1 }).where(eq(products.id, p.id)); // מישהי אחרת קנתה בינתיים

    const res = await agent.post('/api/checkout').send(SHIPPING);
    expect(res.status).toBe(409);
    expect(await stockOf(p.id)).toBe(1);
    expect(await db.select().from(orders)).toHaveLength(0);
  });

  it('כמות בסל לא חורגת מהמלאי', async () => {
    const p = await createProduct({ stock: 2 });
    const agent = await buyerWithCart(p.id, 5);
    expect((await agent.get('/api/cart')).body[0].quantity).toBe(2);
  });

  it('מוצר שאזל אי אפשר להוסיף לסל', async () => {
    const p = await createProduct({ stock: 0 });
    await createUser('buyer@test.dev');
    const agent = await loginAs('buyer@test.dev');
    const res = await agent.post('/api/cart/items').send({ productId: p.id });
    expect(res.status).toBe(409);
  });

  it('ביטול הזמנה מחזיר מלאי', async () => {
    const p = await createProduct({ stock: 5 });
    const agent = await buyerWithCart(p.id, 2);
    const { body } = await agent.post('/api/checkout').send(SHIPPING);

    await agent.post(`/api/orders/${body.id}/cancel`);
    expect(await stockOf(p.id)).toBe(5);
  });

  it('הזמנה שפגה מחזירה מלאי', async () => {
    const p = await createProduct({ stock: 5 });
    const agent = await buyerWithCart(p.id, 2);
    const { body } = await agent.post('/api/checkout').send(SHIPPING);

    await db.update(orders).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(orders.id, body.id));
    await expireOldOrders();

    expect(await stockOf(p.id)).toBe(5);
    const [o] = await db.select().from(orders).where(eq(orders.id, body.id));
    expect(o.status).toBe('expired');
  });

  it('צ׳קאאוט דורש אימייל מאומת', async () => {
    const p = await createProduct();
    const agent = await buyerWithCart(p.id, 1, false);
    const res = await agent.post('/api/checkout').send(SHIPPING);
    expect(res.status).toBe(403);
    expect(await stockOf(p.id)).toBe(5);
  });
});