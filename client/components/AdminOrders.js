'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';
import AdminNav from './AdminNav';

const STATUS = {
  pending: 'ממתינה לתשלום',
  paid: 'שולמה',
  cancelled: 'בוטלה',
  expired: 'פג תוקפה',
};

// ממיר מספר ישראלי לפורמט הבינלאומי ש-wa.me דורש (למשל 0501234567 -> 972501234567)
function waNumber(phone) {
  let d = String(phone).replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('972')) return d;
  if (d.startsWith('0')) return '972' + d.slice(1);
  return d;
}

function waLink(o) {
  const text = `שלום ${o.fullName}, כאן myShop. לגבי הזמנה #${o.id}: `;
  return `https://wa.me/${waNumber(o.phone)}?text=${encodeURIComponent(text)}`;
}

export default function AdminOrders() {
  const [user, setUser] = useState(undefined);
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('paid');
  const [error, setError] = useState('');

  const load = useCallback(async (s) => {
    setError('');
    const { ok, data } = await api(`/api/admin/orders${s ? `?status=${s}` : ''}`);
    if (!ok) return setError(data?.error ?? 'משהו השתבש');
    setOrders(data);
  }, []);

  useEffect(() => {
    api('/api/auth/me').then(({ ok, data }) => setUser(ok ? data : null));
  }, []);

  const allowed = user && ['staff', 'admin'].includes(user.role);

  useEffect(() => {
    if (allowed) load(status);
  }, [allowed, status, load]);

  if (user === undefined) return <main className="auth"><p>טוענת...</p></main>;
  if (!allowed) {
    return (
      <main className="auth">
        <h1>אין הרשאה</h1>
        <p><Link href={user ? '/' : '/login'}>{user ? 'חזרה לחנות' : 'להתחברות'}</Link></p>
      </main>
    );
  }

  const fmt = (d) => new Date(d).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <main className="admin">
      <div className="admin-head">
        <h1>הזמנות</h1>
        <AdminNav role={user.role} current="/admin/orders" />
      </div>

      <label className="orders-filter">
        סטטוס{' '}
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">הכל</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>

      {error && <p className="error" role="alert">{error}</p>}
      {!error && orders.length === 0 && <p>אין הזמנות להצגה.</p>}

      <div className="orders-list">
        {orders.map((o) => (
          <article className="order-card" key={o.id}>
            <header>
              <strong>הזמנה #{o.id}</strong>
              <span className={'order-status ' + o.status}>{STATUS[o.status]}</span>
              <span>{fmt(o.createdAt)}</span>
              <strong>₪{o.total}</strong>
            </header>

            <ul>
              {o.items.map((i) => (
                <li key={i.id}>{i.name} × {i.quantity}</li>
              ))}
            </ul>

            <p>
              {o.fullName} · <span dir="ltr">{o.phone}</span> · {o.email}<br />
              {o.address}, {o.city}
              {o.notes && <><br />הערה: {o.notes}</>}
            </p>

            <div className="order-actions">
              <a className="wa-btn" href={waLink(o)} target="_blank" rel="noopener noreferrer">
                פתיחת וואטסאפ
              </a>
              <small>{o.marketingConsent ? 'אישרה קבלת הודעות שיווק' : 'לא אישרה הודעות שיווק (רק הודעות על ההזמנה)'}</small>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}