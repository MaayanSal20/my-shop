import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../app';
import { sendVerificationEmail } from '../mail';
import { PASSWORD, createUser } from './helpers';

const lastCode = () => vi.mocked(sendVerificationEmail).mock.calls.at(-1)![1];

const VALID_PROFILE = { name: 'ישראלה ישראלי', phone: '050-1234567' };

async function register(agent: ReturnType<typeof request.agent>, email = 'new@test.dev') {
  const res = await agent
    .post('/api/auth/register')
    .send({ email, password: PASSWORD, ...VALID_PROFILE });
  expect(res.status).toBe(201);
  await vi.waitFor(() => expect(sendVerificationEmail).toHaveBeenCalled()); // המייל נשלח ברקע
}

describe('הרשמה ואימות', () => {
  it('אימות בקוד מחבר את המשתמשת ישר', async () => {
    const agent = request.agent(app);
    await register(agent);

    const res = await agent.post('/api/auth/verify').send({ email: 'new@test.dev', code: lastCode() });
    expect(res.status).toBe(200);
    expect((await agent.get('/api/auth/me')).body.emailVerified).toBe(true);
  });

  it('אחרי 5 קודים שגויים גם הקוד הנכון נפסל', async () => {
    const agent = request.agent(app);
    await register(agent);
    const real = lastCode();
    const wrong = real === '111111' ? '222222' : '111111';

    for (let i = 0; i < 5; i++) {
      expect((await agent.post('/api/auth/verify').send({ email: 'new@test.dev', code: wrong })).status).toBe(400);
    }
    expect((await agent.post('/api/auth/verify').send({ email: 'new@test.dev', code: real })).status).toBe(400);
  });

  it('סיסמה קצרה נדחית', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'x@test.dev', password: 'short', ...VALID_PROFILE });
    expect(res.status).toBe(400);
  });

  it('אימייל כפול נדחה', async () => {
    await createUser('dup@test.dev');
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@test.dev', password: PASSWORD, ...VALID_PROFILE });
    expect(res.status).toBe(409);
  });

  it('דוחה טלפון לא תקין', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'bad-phone@test.dev', password: PASSWORD, name: 'ישראלה ישראלי', phone: '123' });
    expect(res.status).toBe(400);
  });

  it('דוחה שם בלי שם משפחה', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'bad-name@test.dev', password: PASSWORD, name: 'ישראלה', phone: '0501234567' });
    expect(res.status).toBe(400);
  });

  it('התחברות שגויה: אותה הודעה למשתמשת קיימת ולא קיימת', async () => {
    await createUser('real@test.dev');
    const a = await request(app).post('/api/auth/login').send({ email: 'real@test.dev', password: 'wrong-pass-1' });
    const b = await request(app).post('/api/auth/login').send({ email: 'ghost@test.dev', password: 'wrong-pass-1' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error).toBe(b.body.error);
  });
});