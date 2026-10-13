import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { orders, orderItems, products } from '../db/schema';

export type PayResult = 'paid' | 'already_paid' | 'needs_refund' | 'not_found' | 'amount_mismatch';

// מסמן הזמנה כשולמה. מיועד להיקרא רק אחרי שהתשלום אומת (webhook מאומת, או הספק המדומה)
export async function markOrderPaid(orderId: number, amount: number, ref: string): Promise<PayResult> {
  try {
    return await db.transaction(async (tx) => {
      // נועלים את שורת ההזמנה, כך שקריאות כפולות במקביל מחכות אחת לשנייה
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
      if (!order) return 'not_found' as PayResult;
      if (order.status === 'paid') return 'already_paid' as PayResult; // idempotent
      if (order.total !== amount) return 'amount_mismatch' as PayResult;

      // תשלום מאוחר: ההזמנה פגה או בוטלה והמלאי שוחרר. מנסים לשמור אותו מחדש
      if (order.status !== 'pending') {
        const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
        for (const it of items) {
          if (!it.productId) throw new Error('NO_STOCK');
          const [ok] = await tx
            .update(products)
            .set({ stock: sql`${products.stock} - ${it.quantity}` })
            .where(and(eq(products.id, it.productId), sql`${products.stock} >= ${it.quantity}`))
            .returning({ id: products.id });
          if (!ok) throw new Error('NO_STOCK'); // מבטל את כל הטרנזקציה
        }
      }

      await tx
        .update(orders)
        .set({ status: 'paid', paidAt: new Date(), gatewayRef: ref })
        .where(eq(orders.id, orderId));
      return 'paid' as PayResult;
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'NO_STOCK') {
      console.error(`[payment] הזמנה ${orderId} שולמה אחרי שפגה ואין מלאי. נדרש החזר כספי.`);
      return 'needs_refund';
    }
    throw err;
  }
}