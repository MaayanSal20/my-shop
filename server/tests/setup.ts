import { vi, beforeAll, beforeEach } from 'vitest';

// רשת ביטחון: גם אם ה-mock נכשל, אין חיבור למסד האמיתי (dotenv לא דורס משתנים קיימים)
process.env.DATABASE_URL = 'postgresql://nobody:nobody@127.0.0.1:1/none';
process.env.JWT_SECRET = 'test-secret-only-for-vitest-0123456789abcdef';
process.env.PAYMENT_PROVIDER = 'mock';

// מסד Postgres זמני בזיכרון במקום Supabase
vi.mock('../db', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const schema = await import('../db/schema');
  const db = drizzle(new PGlite(), { schema });
  return { db };
});

// לא שולחים מיילים אמיתיים, ותופסים את הקוד שנשלח
vi.mock('../mail', () => ({ sendVerificationEmail: vi.fn(async () => {}) }));

beforeAll(async () => {
  const h = await import('./helpers');
  await h.setupSchema();
});

beforeEach(async () => {
  const h = await import('./helpers');
  await h.resetDb();
  vi.clearAllMocks();
});