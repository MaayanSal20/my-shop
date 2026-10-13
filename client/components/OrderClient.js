'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';

const STATUS = {
  pending: 'ממתינה לתשלום',
  paid: 'שולמה',
  cancelled: 'בוטלה',
  expired: 'פג תוקפה',
};

export default function OrderClient({ id }) {
  const [order, setOrder] = useState(undefined); // undefined = טוענים, null = לא נמצאה
  const [left, setLeft] = useState(0);
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    const { ok, data } = await api(`/api/orders/${id}`);
    setOrder(ok ? data : null);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!order || order.status !== 'pending') return;
    const tick = () => setLeft(Math.max(0, new Date(order.expiresAt) - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [order]);

  async function cancel() {
    await api(`/api/orders/${id}/cancel`, { method: 'POST' });
    await load();
  }

  async function pay() {
    setPaying(true);
    const { ok, data } = await api(`/api/orders/${id}/pay`, { method: 'POST' });
    if (ok) {
      window.location.href = data.url;
    } else {
      setPaying(false);
      await load();
    }
  }

  if (order === undefined) return <main className="auth"><p>טוענת...</p></main>;
  if (order === null) {
    return (
      <main className="auth">
        <h1>ההזמנה לא נמצאה</h1>
        <p><Link href="/">חזרה לחנות</Link></p>
      </main>
    );
  }

  const mm = String(Math.floor(left / 60000)).padStart(2, '0');
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');

  return (
    <main className="auth">
      <h1>הזמנה #{order.id}</h1>
      <p>סטטוס: <strong>{STATUS[order.status]}</strong></p>
      {order.status === 'paid' && <p>תודה! התשלום התקבל ✓</p>}

      {order.status === 'pending' && (
        <p>המוצרים שמורים עבורך עוד <strong dir="ltr">{mm}:{ss}</strong></p>
      )}

      <div className="order-items">
        {order.items.map((i) => (
          <div className="order-row" key={i.id}>
            <span>{i.name} × {i.quantity}</span>
            <span>₪{i.unitPrice * i.quantity}</span>
          </div>
        ))}
        <div className="order-row total"><span>סה״כ</span><span>₪{order.total}</span></div>
      </div>

      {order.status === 'pending' && (
        <>
          <button className="btn" onClick={pay} disabled={paying}>
            {paying ? 'רגע...' : 'לתשלום'}
          </button>
          <p><button className="link-btn" onClick={cancel}>ביטול ההזמנה</button></p>
        </>
      )}

      {(order.status === 'expired' || order.status === 'cancelled') && (
        <p>המלאי שוחרר. <Link href="/">חזרה לחנות</Link></p>
      )}
    </main>
  );
}