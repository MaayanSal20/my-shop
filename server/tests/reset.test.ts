import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../app';
import { sendPasswordResetEmail } from '../mail';
import { PASSWORD, createUser } from './helpers';

const lastResetCode = () => vi.mocked(sendPasswordResetEmail).mock.calls.at(-1)![1];
const NEW_PASSWORD = 'NewPassw0rd!x';

async function requestReset(email: string) {
  const res = await request(app).post('/api/auth/forgot-password').send({ email });
  expect(res.status).toBe(200);
}

describe('שכחתי סיסמה', () => {
  it('קוד נכון מחליף סיסמה, והישנה מפסיקה לעבוד', async () => {
    await createUser('forgot@test.dev');
    await requestReset('forgot@test.dev');
    await vi.waitFor(() => expect(sendPasswordResetEmail).toHaveBeenCalled());

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ email: 'forgot@test.dev', code: lastResetCode(), password: NEW_PASSWORD });
    expect(res.status).toBe(200);

    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'forgot@test.dev', password: PASSWORD });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'forgot@test.dev', password: NEW_PASSWORD });
    expect(newLogin.status).toBe(200);
  });

  it('אימייל לא קיים: אותה תשובה ולא נשלח מייל', async () => {
    await requestReset('ghost@test.dev');
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('קוד שגוי נדחה', async () => {
    await createUser('wrong@test.dev');
    await requestReset('wrong@test.dev');
    await vi.waitFor(() => expect(sendPasswordResetEmail).toHaveBeenCalled());
    const real = lastResetCode();
    const wrong = real === '111111' ? '222222' : '111111';

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ email: 'wrong@test.dev', code: wrong, password: NEW_PASSWORD });
    expect(res.status).toBe(400);
  });

  it('אחרי 5 קודים שגויים גם הקוד הנכון נפסל', async () => {
    await createUser('brute@test.dev');
    await requestReset('brute@test.dev');
    await vi.waitFor(() => expect(sendPasswordResetEmail).toHaveBeenCalled());
    const real = lastResetCode();
    const wrong = real === '111111' ? '222222' : '111111';

    for (let i = 0; i < 5; i++) {
      const r = await request(app)
        .post('/api/auth/reset-password')
        .send({ email: 'brute@test.dev', code: wrong, password: NEW_PASSWORD });
      expect(r.status).toBe(400);
    }
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ email: 'brute@test.dev', code: real, password: NEW_PASSWORD });
    expect(res.status).toBe(400);
  });
});