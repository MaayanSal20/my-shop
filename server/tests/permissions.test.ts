import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';
import { createProduct, createUser, loginAs } from './helpers';

const NEW_PRODUCT = { name: 'חדש', category: 'תיקים', price: 50, stock: 3 };

describe('הרשאות', () => {
  it('בלי התחברות: 401', async () => {
    const res = await request(app).post('/api/admin/products').send(NEW_PRODUCT);
    expect(res.status).toBe(401);
  });

  it('לקוחה לא מגיעה לנתיבי ניהול: 403', async () => {
    await createUser('c@test.dev');
    const agent = await loginAs('c@test.dev');
    expect((await agent.post('/api/admin/products').send(NEW_PRODUCT)).status).toBe(403);
    expect((await agent.get('/api/admin/orders')).status).toBe(403);
    expect((await agent.get('/api/admin/users')).status).toBe(403);
  });

  it('עובדת יכולה להוסיף מוצר ולשנות מחיר', async () => {
    await createUser('s@test.dev', 'staff');
    const agent = await loginAs('s@test.dev');
    const created = await agent.post('/api/admin/products').send(NEW_PRODUCT);
    expect(created.status).toBe(201);
    const patched = await agent.patch(`/api/admin/products/${created.body.id}`).send({ price: 80 });
    expect(patched.body.price).toBe(80);
  });

  it('מוצר שאזל: עובדת לא יכולה להוסיף מלאי, מנהלת יכולה', async () => {
    const p = await createProduct({ stock: 0 });
    await createUser('s@test.dev', 'staff');
    await createUser('a@test.dev', 'admin');

    const staff = await loginAs('s@test.dev');
    expect((await staff.patch(`/api/admin/products/${p.id}`).send({ stock: 10 })).status).toBe(403);

    const admin = await loginAs('a@test.dev');
    const res = await admin.patch(`/api/admin/products/${p.id}`).send({ stock: 10 });
    expect(res.status).toBe(200);
    expect(res.body.stock).toBe(10);
  });

  it('מוצר שאזל: עובדת לא יכולה למחוק, מנהלת יכולה', async () => {
    const p = await createProduct({ stock: 0 });
    await createUser('s@test.dev', 'staff');
    await createUser('a@test.dev', 'admin');

    const staff = await loginAs('s@test.dev');
    expect((await staff.delete(`/api/admin/products/${p.id}`)).status).toBe(403);

    const admin = await loginAs('a@test.dev');
    expect((await admin.delete(`/api/admin/products/${p.id}`)).status).toBe(200);
  });

  it('רק מנהלת רואה ומנהלת משתמשות', async () => {
    await createUser('s@test.dev', 'staff');
    await createUser('a@test.dev', 'admin');
    expect((await (await loginAs('s@test.dev')).get('/api/admin/users')).status).toBe(403);
    expect((await (await loginAs('a@test.dev')).get('/api/admin/users')).status).toBe(200);
  });

  it('מנהלת לא יכולה לשנות את התפקיד של עצמה', async () => {
    const admin = await createUser('a@test.dev', 'admin');
    const agent = await loginAs('a@test.dev');
    const res = await agent.patch(`/api/admin/users/${admin.id}/role`).send({ role: 'customer' });
    expect(res.status).toBe(403);
  });

  it('אי אפשר לתת הרשאות למשתמשת עם אימייל לא מאומת', async () => {
    const target = await createUser('t@test.dev', 'customer', false);
    await createUser('a@test.dev', 'admin');
    const agent = await loginAs('a@test.dev');
    const res = await agent.patch(`/api/admin/users/${target.id}/role`).send({ role: 'staff' });
    expect(res.status).toBe(400);
  });

  it('הענקת הרשאה נכנסת לתוקף מיד, בלי התחברות מחדש', async () => {
    const target = await createUser('t@test.dev');
    await createUser('a@test.dev', 'admin');
    const targetAgent = await loginAs('t@test.dev');
    expect((await targetAgent.get('/api/admin/orders')).status).toBe(403);

    const admin = await loginAs('a@test.dev');
    await admin.patch(`/api/admin/users/${target.id}/role`).send({ role: 'staff' });
    expect((await targetAgent.get('/api/admin/orders')).status).toBe(200);
  });
});