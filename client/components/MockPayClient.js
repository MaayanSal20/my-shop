'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';

export default function MockPayClient({ orderId }) {
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/api/orders/${orderId}`).then(({ ok, data }) => ok && setOrder(data));
  }, [orderId]);

  async function confirm() {
    setLoading(true);
    const { ok, data } = await api('/api/payments/mock/confirm', {
      method: 'POST',
      body: { orderId: Number(orderId) },
    });
    if (!ok) {
      setLoading(false);
      return setError(data?.error ?? 'משהו השתבש');
    }
    router.push(`/order/${orderId}`);
  }

  return (
    <main className="auth">
      <h1>תשלום (סביבת דמו)</h1>
      <p>זה דף תשלום מדומה. בפרודקשן הוא יוחלף בדף המאובטח של חברת הסליקה. אל תקלידי כאן פרטי אשראי אמיתיים, ואין כאן שדות כאלה.</p>
      {order && <p>הזמנה #{order.id} · סה״כ <strong>₪{order.total}</strong></p>}
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn" onClick={confirm} disabled={loading || !order}>
        {loading ? 'רגע...' : 'אישור תשלום (דמו)'}
      </button>
      <p><button className="link-btn" onClick={() => router.push(`/order/${orderId}`)}>חזרה להזמנה בלי לשלם</button></p>
    </main>
  );
}