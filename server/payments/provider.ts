import 'dotenv/config';

export type PayableOrder = { id: number; total: number };

export interface PaymentProvider {
  name: string;
  createSession(order: PayableOrder): Promise<{ url: string; ref: string }>;
}

const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:3000';

// ספק מדומה לפיתוח: "דף התשלום" הוא דף שלנו עם כפתור אישור
const mock: PaymentProvider = {
  name: 'mock',
  async createSession(order) {
    return {
      ref: `mock_${order.id}_${Date.now()}`,
      url: `${CLIENT_URL}/pay/mock?order=${order.id}`,
    };
  },
};

export function getProvider(): PaymentProvider {
  const name = process.env.PAYMENT_PROVIDER ?? 'mock';
  if (name === 'mock') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('תשלום מדומה אסור בפרודקשן');
    }
    return mock;
  }
  // כאן נוסיף את Grow בשלב הבא
  throw new Error(`ספק תשלום לא מוכר: ${name}`);
}