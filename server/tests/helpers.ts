import bcrypt from 'bcryptjs';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { pushSchema } from 'drizzle-kit/api';
import app from '../app';
import { db } from '../db';
import * as schema from '../db/schema';

export const PASSWORD = 'Passw0rd!test';
const HASH = bcrypt.hashSync(PASSWORD, 4); // מעט סבבים כדי שהבדיקות יהיו מהירות

export const SHIPPING = {
  city: 'ירושלים',
  address: 'הרצל 1',
};

export async function setupSchema() {
  const { apply } = await pushSchema(schema, db as any);
  await apply();
}

export async function resetDb() {
  await db.execute(
    sql`truncate table order_items, orders, cart_items, email_tokens, users, products restart identity cascade`
  );
}

export async function createUser(
  email: string,
  role: 'customer' | 'staff' | 'admin' = 'customer',
  verified = true
) {
  const [u] = await db
    .insert(schema.users)
    .values({
      email,
      passwordHash: HASH,
      role,
      emailVerified: verified,
      name: 'ישראלה ישראלי',
      phone: '0501234567',
    })
    .returning();
  return u;
}

// מחזיר "דפדפן" מחובר: שומר את העוגייה בין הבקשות
export async function loginAs(email: string) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed: ${res.status}`);
  return agent;
}

export async function createProduct(over: Partial<typeof schema.products.$inferInsert> = {}) {
  const [p] = await db
    .insert(schema.products)
    .values({ name: 'מוצר בדיקה', category: 'תיקים', price: 100, stock: 5, color: '#E4DDD3', ...over })
    .returning();
  return p;
}