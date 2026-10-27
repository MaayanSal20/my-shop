'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { isKnownCity } from '../../lib/cities';
import CityInput from '../../components/CityInput';

const STATUS = {
  pending: 'ממתינה לתשלום',
  paid: 'שולמה',
  cancelled: 'בוטלה',
  expired: 'פג תוקפה',
};

export default function AccountPage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await api('/api/me/profile');
      if (p.status === 401) return router.push('/login');
      if (p.ok) setProfile(p.data);
      const o = await api('/api/me/orders');
      if (o.ok) setOrders(o.data);
    })();
  }, [router]);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setSaved('');
    const f = new FormData(e.currentTarget);
    const city = String(f.get('city') ?? '').trim();
    if (city && !isKnownCity(city)) return setError('נא לבחור עיר מהרשימה');

    setSaving(true);
    const { ok, data } = await api('/api/me/profile', {
      method: 'PATCH',
      body: {
        name: f.get('name'),
        phone: f.get('phone'),
        city,
        address: f.get('address'),
      },
    });
    setSaving(false);
    if (!ok) return setError(data?.error ?? 'משהו השתבש, נסי שוב');
    setSaved('הפרטים נשמרו');
  }

  if (!profile) {
    return <main className="auth"><p>טוען...</p></main>;
  }

  return (
    <main className="auth" style={{ maxWidth: 640 }}>
      <h1>האזור האישי</h1>

      <form onSubmit={onSubmit}>
        <label>אימייל (לא ניתן לשינוי)
          <input value={profile.email} readOnly disabled />
        </label>
        <label>שם מלא
          <input name="name" required defaultValue={profile.name ?? ''} autoComplete="name" />
        </label>
        <label>טלפון נייד
          <input
            name="phone"
            type="tel"
            required
            inputMode="tel"
            defaultValue={profile.phone ?? ''}
            placeholder="050-1234567"
            autoComplete="tel"
          />
        </label>
        <label>עיר
          <CityInput defaultValue={profile.city ?? ''} />
        </label>
        <label>רחוב ומספר בית
          <input name="address" defaultValue={profile.address ?? ''} autoComplete="street-address" />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <p role="status">{saved}</p>
        <button className="btn" disabled={saving}>{saving ? 'שומרת...' : 'שמירת פרטים'}</button>
      </form>

      <h2 style={{ marginTop: 40 }}>ההזמנות שלי</h2>
      {orders.length === 0 && <p>עדיין אין הזמנות.</p>}
      <div className="orders-list">
        {orders.map((o) => (
          <article key={o.id} className="order-card">
            <header>
              <strong>הזמנה #{o.id}</strong>
              <span>{new Date(o.createdAt).toLocaleDateString('he-IL')}</span>
              <span className={`order-status ${o.status}`}>{STATUS[o.status] ?? o.status}</span>
            </header>
            <ul>
              {o.items.map((i, idx) => (
                <li key={idx}>{i.name} × {i.quantity}</li>
              ))}
            </ul>
            <p>סה״כ ₪{o.total}</p>
            {o.status === 'pending' && <Link href={`/order/${o.id}`}>להמשך תשלום</Link>}
          </article>
        ))}
      </div>
    </main>
  );
}