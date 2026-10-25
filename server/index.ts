import 'dotenv/config';
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { and, desc, eq, ilike, inArray, lt, sql } from 'drizzle-orm';
import { products, users, emailTokens, cartItems, orders, orderItems } from './db/schema';
import { db } from './db';
import { sendVerificationEmail } from './mail';
import { getProvider } from './payments/provider';
import { markOrderPaid } from './payments/markPaid';
import multer from 'multer';
import { detectImage, uploadProductImage } from './storage';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

// ---------- הגדרות כלליות ----------
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET חסר ב-.env');

const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:3000';

const app = express();

// מאחורי שרת אירוח (פרוקסי) צריך לספר ל-Express, אחרת כל הבקשות ייראו כאילו הגיעו מאותה כתובת.
// הערך 1 מתאים לפרוקסי אחד. לוודא מול שירות האירוח שנבחר
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '10kb' }));

// ---------- הגבלת בקשות ----------
const TOO_MANY = { error: 'יותר מדי ניסיונות. נסי שוב בעוד כמה דקות.' };

function limiter(
  windowMinutes: number,
  limit: number,
  key?: (req: Request) => string,
  skipSuccessful = false
) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: TOO_MANY,
    skipSuccessfulRequests: skipSuccessful,
    ...(key ? { keyGenerator: key } : {}),
  });
}

// מגביל לפי האימייל שבגוף הבקשה (בנוסף להגבלה לפי כתובת IP)
const byEmail = (prefix: string, limit: number, skipSuccessful = false) =>
  limiter(
    15,
    limit,
    (req) => `${prefix}:${String(req.body?.email ?? '').trim().toLowerCase().slice(0, 100)}`,
    skipSuccessful
  );

app.use('/api', limiter(1, 300)); // הגבלה כללית
const authIpLimit = limiter(15, 20); // 20 בקשות ל-15 דקות מכתובת אחת

// ---------- הרשאות ----------
type Role = 'customer' | 'staff' | 'admin';
type AuthedRequest = Request & {
  user?: { id: number; email: string; role: Role; emailVerified: boolean };
};

// בודק שיש עוגייה תקפה וטוען את המשתמש מהמסד
async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ error: 'נדרשת התחברות' });

    const payload = jwt.verify(token, JWT_SECRET!, { algorithms: ['HS256'] }) as jwt.JwtPayload;
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        emailVerified: users.emailVerified,
      })
      .from(users)
      .where(eq(users.id, Number(payload.sub)));
    if (!user) return res.status(401).json({ error: 'נדרשת התחברות' });

    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'נדרשת התחברות' });
  }
}

// בודק שהתפקיד מורשה: requireRole('staff', 'admin')
function requireRole(...roles: Role[]) {
  return [
    requireAuth,
    (req: AuthedRequest, res: Response, next: NextFunction) => {
      if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'אין הרשאה' });
      }
      next();
    },
  ];
}

// ---------- אימות אימייל בקוד ----------
const CODE_TTL_MS = 10 * 60 * 1000; // תוקף הקוד
const MAX_ATTEMPTS = 5; // ניסיונות שגויים מותרים
const RESEND_COOLDOWN_MS = 60 * 1000; // המתנה בין שליחות

function hashCode(code: string) {
  return crypto.createHmac('sha256', JWT_SECRET!).update(code).digest('hex');
}

async function issueVerification(userId: number, email: string) {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await db.delete(emailTokens).where(eq(emailTokens.userId, userId)); // קוד ישן מתבטל
  await db.insert(emailTokens).values({
    userId,
    tokenHash: hashCode(code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });
  await sendVerificationEmail(email, code);
}

// שמה עוגיית התחברות (משמש גם בהתחברות וגם אחרי אימות)
function setAuthCookie(res: Response, userId: number) {
  const token = jwt.sign({ sub: String(userId) }, JWT_SECRET!, {
    expiresIn: '7d',
    algorithm: 'HS256',
  });
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

// ---------- בדיקת חיים ----------
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// ---------- מוצרים ----------
// כל המוצרים, עם סינון אופציונלי: /api/products?category=תיקים
app.get('/api/products', async (req, res) => {
  try {
    const { category } = req.query;
    const rows = await db
      .select()
      .from(products)
      .where(typeof category === 'string' ? eq(products.category, category) : undefined)
      .orderBy(products.id);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// מוצר בודד: /api/products/3
app.get('/api/products/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'מזהה לא תקין' });
    }
    const [product] = await db.select().from(products).where(eq(products.id, id));
    if (!product) {
      return res.status(404).json({ error: 'המוצר לא נמצא' });
    }
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// ---------- הרשמה והתחברות ----------
app.post('/api/auth/register', limiter(60, 10), async (req, res) => {
  try {
    const { email, password, name, phone, marketingConsent } = req.body ?? {};

    if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: 'אימייל לא תקין' });
    }
    if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72) {
      return res.status(400).json({
        error: 'הסיסמה חייבת להיות באורך 8 תווים לפחות ועד 72 בייטים (אות עברית תופסת 2)',
      });
    }

    const normalized = email.trim().toLowerCase();
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalized));
    if (existing) {
      return res.status(409).json({ error: 'האימייל כבר רשום' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db
      .insert(users)
      .values({
        email: normalized,
        passwordHash,
        name,
        phone,
        marketingConsent: marketingConsent === true,
      })
      .returning({ id: users.id, email: users.email, role: users.role });

    // שולחים מייל אימות. בלי await, כדי שכשל במייל לא יפיל את ההרשמה
    console.log('[register] שולחת אימות אל', user.email);
    issueVerification(user.id, user.email).catch((e) => console.error('[verify] נכשל:', e));

    res.status(201).json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// השוואה מול גיבוב מדומה כשהמשתמשת לא קיימת, כדי שזמן התגובה לא יגלה אילו אימיילים רשומים
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 12);

app.post('/api/auth/login', authIpLimit, byEmail('login', 8, true), async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'חסרים פרטים' });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()));
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) {
      return res.status(401).json({ error: 'אימייל או סיסמה שגויים' });
    }

    setAuthCookie(res, user.id);
    res.json({ id: user.id, email: user.email, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
  res.json(req.user);
});

// ---------- אימות אימייל ----------
app.post('/api/auth/verify', authIpLimit, byEmail('verify', 10), async (req, res) => {
  try {
    const { email, code } = req.body ?? {};
    const fail = () =>
      res.status(400).json({ error: 'הקוד שגוי או שפג תוקפו. אפשר לבקש קוד חדש.' });

    if (typeof email !== 'string' || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      return fail();
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()));
    if (!user || user.emailVerified) return fail();

    const [row] = await db.select().from(emailTokens).where(eq(emailTokens.userId, user.id));
    if (!row || row.expiresAt < new Date() || row.attempts >= MAX_ATTEMPTS) return fail();

    const a = Buffer.from(hashCode(code));
    const b = Buffer.from(row.tokenHash);
    const match = a.length === b.length && crypto.timingSafeEqual(a, b);

    if (!match) {
      await db
        .update(emailTokens)
        .set({ attempts: sql`${emailTokens.attempts} + 1` })
        .where(eq(emailTokens.id, row.id));
      return fail();
    }

    await db.update(users).set({ emailVerified: true }).where(eq(users.id, user.id));
    await db.delete(emailTokens).where(eq(emailTokens.userId, user.id));

    setAuthCookie(res, user.id); // מחברים אותה ישר, בלי התחברות נפרדת
    res.json({ id: user.id, email: user.email, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// בקשת קוד חדש. התשובה תמיד זהה, כדי לא לחשוף אילו אימיילים רשומים
app.post('/api/auth/resend-code', authIpLimit, byEmail('resend', 5), async (req, res) => {
  try {
    const { email } = req.body ?? {};
    if (typeof email === 'string') {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.trim().toLowerCase()));

      if (user && !user.emailVerified) {
        const [row] = await db.select().from(emailTokens).where(eq(emailTokens.userId, user.id));
        const tooSoon = row && Date.now() - row.createdAt.getTime() < RESEND_COOLDOWN_MS;
        if (!tooSoon) await issueVerification(user.id, user.email);
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// ---------- ניהול (בדיקה) ----------
app.get('/api/admin/ping', ...requireRole('staff', 'admin'), (req, res) => {
  res.json({ ok: true, message: 'יש לך הרשאת ניהול' });
});

// ---------- עגלה ----------
app.get('/api/cart', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const rows = await db
      .select({
        productId: products.id,
        name: products.name,
        price: products.price,
        color: products.color,
        stock: products.stock,
        quantity: cartItems.quantity,
      })
      .from(cartItems)
      .innerJoin(products, eq(cartItems.productId, products.id))
      .where(eq(cartItems.userId, req.user!.id))
      .orderBy(cartItems.id);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

app.post('/api/cart/items', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const productId = Number(req.body?.productId);
    const qty = Number(req.body?.quantity ?? 1);
    if (!Number.isInteger(productId) || !Number.isInteger(qty) || qty < 1 || qty > 99) {
      return res.status(400).json({ error: 'נתונים לא תקינים' });
    }
    const [product] = await db.select().from(products).where(eq(products.id, productId));
    if (!product) return res.status(404).json({ error: 'המוצר לא נמצא' });
    if (product.stock < 1) return res.status(409).json({ error: 'המוצר אזל מהמלאי' });

    // מוסיף שורה, או מגדיל כמות אם המוצר כבר בעגלה (עד המלאי הקיים)
    await db
      .insert(cartItems)
      .values({ userId: req.user!.id, productId, quantity: Math.min(qty, product.stock) })
      .onConflictDoUpdate({
        target: [cartItems.userId, cartItems.productId],
        set: {
          quantity: sql`least(${cartItems.quantity} + ${qty}, ${product.stock})`,
          updatedAt: new Date(),
        },
      });
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

app.patch('/api/cart/items/:productId', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const productId = Number(req.params.productId);
    const quantity = Number(req.body?.quantity);
    if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity > 99) {
      return res.status(400).json({ error: 'נתונים לא תקינים' });
    }
    const mine = and(eq(cartItems.userId, req.user!.id), eq(cartItems.productId, productId));

    const [product] = await db.select().from(products).where(eq(products.id, productId));
    const capped = product ? Math.min(quantity, product.stock) : 0;

    if (capped < 1) {
      await db.delete(cartItems).where(mine);
    } else {
      await db.update(cartItems).set({ quantity: capped, updatedAt: new Date() }).where(mine);
    }
    res.json({ ok: true, quantity: Math.max(capped, 0) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

app.delete('/api/cart/items/:productId', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const productId = Number(req.params.productId);
    if (!Number.isInteger(productId)) return res.status(400).json({ error: 'נתונים לא תקינים' });
    await db
      .delete(cartItems)
      .where(and(eq(cartItems.userId, req.user!.id), eq(cartItems.productId, productId)));
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// ---------- הזמנות ותחילת תשלום ----------
const HOLD_MS = 15 * 60 * 1000; // כמה זמן המלאי שמור

class CheckoutError extends Error {
  status: number;
  constructor(message: string, status = 409) {
    super(message);
    this.status = status;
  }
}

// משחרר הזמנה ממתינה: משנה סטטוס ומחזיר את המלאי. מחזיר false אם כבר לא ממתינה
async function releaseOrder(orderId: number, newStatus: 'expired' | 'cancelled') {
  return db.transaction(async (tx) => {
    const [o] = await tx
      .update(orders)
      .set({ status: newStatus })
      .where(and(eq(orders.id, orderId), eq(orders.status, 'pending')))
      .returning({ id: orders.id });
    if (!o) return false;

    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    for (const it of items) {
      if (it.productId) {
        await tx
          .update(products)
          .set({ stock: sql`${products.stock} + ${it.quantity}` })
          .where(eq(products.id, it.productId));
      }
    }
    return true;
  });
}

async function expireOldOrders() {
  const old = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.status, 'pending'), lt(orders.expiresAt, new Date())));
  for (const o of old) await releaseOrder(o.id, 'expired');
}
setInterval(() => expireOldOrders().catch(console.error), 60_000);

app.post('/api/checkout', limiter(15, 10), requireAuth, async (req: AuthedRequest, res) => {
  try {
    if (!req.user!.emailVerified) {
      return res.status(403).json({ error: 'יש לאמת את כתובת האימייל לפני רכישה' });
    }

    const b = req.body ?? {};
    const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
    const fullName = clean(b.fullName, 100);
    const phone = clean(b.phone, 20);
    const city = clean(b.city, 60);
    const address = clean(b.address, 150);
    const notes = clean(b.notes, 300);
    if (!fullName || !city || !address || !/^[0-9+\-\s]{9,15}$/.test(phone)) {
      return res.status(400).json({ error: 'יש למלא שם, טלפון תקין, עיר וכתובת' });
    }

    await expireOldOrders(); // משחרר מלאי של הזמנות שפגו לפני שבודקים זמינות

    const userId = req.user!.id;
    const order = await db.transaction(async (tx) => {
      const cart = await tx
        .select({
          productId: products.id,
          name: products.name,
          price: products.price,
          quantity: cartItems.quantity,
        })
        .from(cartItems)
        .innerJoin(products, eq(cartItems.productId, products.id))
        .where(eq(cartItems.userId, userId));

      if (cart.length === 0) throw new CheckoutError('העגלה ריקה', 400);

      // שומרים מלאי: הורדה אטומית רק אם יש מספיק. אם לא, כל ההזמנה מתבטלת
      for (const it of cart) {
        const [ok] = await tx
          .update(products)
          .set({ stock: sql`${products.stock} - ${it.quantity}` })
          .where(and(eq(products.id, it.productId), sql`${products.stock} >= ${it.quantity}`))
          .returning({ id: products.id });
        if (!ok) throw new CheckoutError(`"${it.name}" אזל או שאין מספיק במלאי`);
      }

      // הסכום מחושב מהמחירים במסד, לא ממה שהלקוח שלח
      const total = cart.reduce((t, i) => t + i.price * i.quantity, 0);

      const [created] = await tx
        .insert(orders)
        .values({
          userId,
          total,
          fullName,
          phone,
          city,
          address,
          notes: notes || null,
          expiresAt: new Date(Date.now() + HOLD_MS),
        })
        .returning({ id: orders.id, total: orders.total, expiresAt: orders.expiresAt });

      await tx.insert(orderItems).values(
        cart.map((i) => ({
          orderId: created.id,
          productId: i.productId,
          name: i.name,
          unitPrice: i.price,
          quantity: i.quantity,
        }))
      );

      await tx.delete(cartItems).where(eq(cartItems.userId, userId));
      return created;
    });

    res.status(201).json(order);
  } catch (err) {
    if (err instanceof CheckoutError) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// הזמנה בודדת: רק הבעלים רואה
app.get('/api/orders/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'מזהה לא תקין' });
    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, id), eq(orders.userId, req.user!.id)));
    if (!order) return res.status(404).json({ error: 'ההזמנה לא נמצאה' });
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
    res.json({ ...order, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

app.post('/api/orders/:id/cancel', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'מזהה לא תקין' });
    const [order] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.id, id), eq(orders.userId, req.user!.id)));
    if (!order) return res.status(404).json({ error: 'ההזמנה לא נמצאה' });
    await releaseOrder(id, 'cancelled');
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// פותח תשלום להזמנה: מקבל מהספק כתובת דף תשלום
app.post('/api/orders/:id/pay', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'מזהה לא תקין' });

    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, id), eq(orders.userId, req.user!.id)));
    if (!order) return res.status(404).json({ error: 'ההזמנה לא נמצאה' });
    if (order.status !== 'pending' || order.expiresAt < new Date()) {
      return res.status(409).json({ error: 'ההזמנה כבר לא פעילה' });
    }

    const session = await getProvider().createSession({ id: order.id, total: order.total });
    await db.update(orders).set({ gatewayRef: session.ref }).where(eq(orders.id, id));
    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// אישור תשלום של הספק המדומה (פיתוח בלבד)
app.post('/api/payments/mock/confirm', requireAuth, async (req: AuthedRequest, res) => {
  try {
    if (
      process.env.NODE_ENV === 'production' ||
      (process.env.PAYMENT_PROVIDER ?? 'mock') !== 'mock'
    ) {
      return res.status(404).json({ error: 'לא נמצא' });
    }
    const id = Number(req.body?.orderId);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'מזהה לא תקין' });

    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, id), eq(orders.userId, req.user!.id)));
    if (!order) return res.status(404).json({ error: 'ההזמנה לא נמצאה' });

    const result = await markOrderPaid(id, order.total, order.gatewayRef ?? `mock_${id}`);
    res.json({ result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// ---------- ניהול מוצרים (עובד/מנהל) ----------
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function parseProductInput(b: any, partial: boolean) {
  const out: Record<string, unknown> = {};
  const errors: string[] = [];

  const text = (key: string, label: string, max: number) => {
    if (b[key] === undefined) return !partial && errors.push(`חסר ${label}`);
    const v = typeof b[key] === 'string' ? b[key].trim() : '';
    if (!v || v.length > max) errors.push(`${label} לא תקין`);
    else out[key] = v;
  };
  const int = (key: string, label: string, max: number) => {
    if (b[key] === undefined) return !partial && errors.push(`חסר ${label}`);
    const n = Number(b[key]);
    if (!Number.isInteger(n) || n < 0 || n > max) errors.push(`${label} לא תקין`);
    else out[key] = n;
  };

  text('name', 'שם', 100);
  text('category', 'קטגוריה', 40);
  int('price', 'מחיר', 100000);
  int('stock', 'מלאי', 100000);

  if (b.color !== undefined) {
    if (typeof b.color === 'string' && HEX_COLOR.test(b.color)) out.color = b.color;
    else errors.push('צבע לא תקין');
  } else if (!partial) out.color = '#E4DDD3';

  if (b.icon !== undefined) out.icon = typeof b.icon === 'string' ? b.icon.slice(0, 30) : null;

  return { data: out, errors };
}

app.post('/api/admin/products', ...requireRole('staff', 'admin'), async (req, res) => {
  try {
    const { data, errors } = parseProductInput(req.body ?? {}, false);
    if (errors.length) return res.status(400).json({ error: errors.join(', ') });
    const [created] = await db.insert(products).values(data as any).returning();
    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

app.patch(
  '/api/admin/products/:id',
  ...requireRole('staff', 'admin'),
  async (req: AuthedRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: 'מזהה לא תקין' });

      const { data, errors } = parseProductInput(req.body ?? {}, true);
      if (errors.length) return res.status(400).json({ error: errors.join(', ') });
      if (Object.keys(data).length === 0) return res.status(400).json({ error: 'אין מה לעדכן' });

      const [product] = await db.select().from(products).where(eq(products.id, id));
      if (!product) return res.status(404).json({ error: 'המוצר לא נמצא' });

      // מוצר שאזל: רק מנהל יכול להוסיף לו מלאי
      if (data.stock !== undefined && product.stock === 0 && req.user!.role !== 'admin') {
        return res.status(403).json({ error: 'רק מנהל יכול להוסיף מלאי למוצר שאזל' });
      }

      const [updated] = await db.update(products).set(data).where(eq(products.id, id)).returning();
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }
);

app.delete(
  '/api/admin/products/:id',
  ...requireRole('staff', 'admin'),
  async (req: AuthedRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: 'מזהה לא תקין' });

      const [product] = await db.select().from(products).where(eq(products.id, id));
      if (!product) return res.status(404).json({ error: 'המוצר לא נמצא' });

      if (product.stock === 0 && req.user!.role !== 'admin') {
        return res.status(403).json({ error: 'רק מנהל יכול להסיר מוצר שאזל' });
      }

      await db.delete(products).where(eq(products.id, id));
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }
);

// ---------- העלאת תמונת מוצר ----------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024, files: 1 }, // עד 3MB
});

const imageUpload = (req: Request, res: Response, next: NextFunction) =>
  upload.single('image')(req, res, (err: any) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'התמונה גדולה מדי (עד 3MB)' : 'ההעלאה נכשלה';
      return res.status(400).json({ error: msg });
    }
    next();
  });

// requireRole רץ קודם, אז רק עובד או מנהל מגיעים לשלב קבלת הקובץ
app.post(
  '/api/admin/products/:id/image',
  ...requireRole('staff', 'admin'),
  imageUpload,
  async (req: AuthedRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: 'מזהה לא תקין' });

      const [product] = await db.select().from(products).where(eq(products.id, id));
      if (!product) return res.status(404).json({ error: 'המוצר לא נמצא' });

      const file = req.file;
      if (!file) return res.status(400).json({ error: 'לא נבחר קובץ' });

      const kind = detectImage(file.buffer);
      if (!kind) return res.status(400).json({ error: 'רק תמונות JPG, PNG או WebP' });

      const imageUrl = await uploadProductImage(file.buffer, kind.ext, kind.mime);
      const [updated] = await db
        .update(products)
        .set({ imageUrl })
        .where(eq(products.id, id))
        .returning();
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }
);

// ---------- רשימת הזמנות (עובד/מנהל) ----------
const ORDER_STATUSES = ['pending', 'paid', 'cancelled', 'expired'] as const;

app.get('/api/admin/orders', ...requireRole('staff', 'admin'), async (req, res) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const filter = (ORDER_STATUSES as readonly string[]).includes(status)
      ? eq(orders.status, status as (typeof ORDER_STATUSES)[number])
      : undefined;

    const rows = await db
      .select({
        id: orders.id,
        status: orders.status,
        total: orders.total,
        fullName: orders.fullName,
        phone: orders.phone,
        city: orders.city,
        address: orders.address,
        notes: orders.notes,
        createdAt: orders.createdAt,
        paidAt: orders.paidAt,
        email: users.email,
        marketingConsent: users.marketingConsent,
      })
      .from(orders)
      .innerJoin(users, eq(orders.userId, users.id))
      .where(filter)
      .orderBy(desc(orders.createdAt))
      .limit(100);

    const ids = rows.map((r) => r.id);
    const items = ids.length
      ? await db.select().from(orderItems).where(inArray(orderItems.orderId, ids))
      : [];

    res.json(rows.map((r) => ({ ...r, items: items.filter((i) => i.orderId === r.id) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// ---------- ניהול משתמשות (מנהלת בלבד) ----------
const ROLES = ['customer', 'staff', 'admin'] as const;
type RoleValue = (typeof ROLES)[number];

app.get('/api/admin/users', ...requireRole('admin'), async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`); // לא נותנים לתווי חיפוש מיוחדים לעבוד
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(q ? ilike(users.email, `%${escaped}%`) : undefined)
      .orderBy(desc(users.createdAt))
      .limit(50);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

app.patch(
  '/api/admin/users/:id/role',
  ...requireRole('admin'),
  async (req: AuthedRequest, res) => {
    try {
      const id = Number(req.params.id);
      const role = req.body?.role;
      if (!Number.isInteger(id) || !(ROLES as readonly unknown[]).includes(role)) {
        return res.status(400).json({ error: 'נתונים לא תקינים' });
      }
      if (id === req.user!.id) {
        return res.status(403).json({ error: 'אי אפשר לשנות את התפקיד של עצמך' });
      }

      const [target] = await db.select().from(users).where(eq(users.id, id));
      if (!target) return res.status(404).json({ error: 'המשתמשת לא נמצאה' });

      if (role !== 'customer' && !target.emailVerified) {
        return res.status(400).json({ error: 'אפשר לתת הרשאות רק למשתמשת עם אימייל מאומת' });
      }

      const [updated] = await db
        .update(users)
        .set({ role: role as RoleValue })
        .where(eq(users.id, id))
        .returning({ id: users.id, email: users.email, role: users.role });
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  }
);

app.listen(4000, () => console.log('Server on http://localhost:4000'));