'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { isKnownCity } from '../../lib/cities';
import CityInput from '../../components/CityInput';
import { useCart } from '../../components/CartProvider';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, total, reload } = useCart();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);

  useEffect(() => {
    api('/api/me/profile').then(({ ok, status, data }) => {
      if (status === 401) return router.push('/login');
      if (ok) setProfile(data);
    });
  }, [router]);

  // שולח קוד אימות ומעביר לדף ההקלדה
  async function startVerify() {
    setSendingCode(true);
    await api('/api/auth/resend-code', { method: 'POST', body: { email: profile.email } });
    router.push(`/verify?email=${encodeURIComponent(profile.email)}`);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    const f = new FormData(e.currentTarget);
    if (!isKnownCity(f.get('city'))) return setError('נא לבחור עיר מהרשימה');

    setLoading(true);
    const { ok, status, data } = await api('/api/checkout', {
      method: 'POST',
      body: { city: f.get('city'), address: f.get('address'), notes: f.get('notes') },
    });
    setLoading(false);
    if (status === 401) return router.push('/login');
    if (!ok) {
      await reload();
      return setError(data?.error ?? 'משהו השתבש, נסי שוב');
    }
    await reload();
    router.push(`/order/${data.id}`);
  }

  if (!profile) {
    return <main className="auth"><p>טוען...</p></main>;
  }

  const incomplete = !profile.name || !profile.phone;
  const unverified = !profile.emailVerified;

  return (
    <main className="auth">
      <h1>פרטי משלוח</h1>
      {items.length > 0 && (
        <p>{items.length} מוצרים בעגלה · סה״כ <strong>₪{total}</strong></p>
      )}

      {unverified && (
        <div className="notice" role="alert">
          <p>כדי לבצע הזמנה צריך לאמת את כתובת האימייל ({profile.email}).</p>
          <button type="button" className="btn" onClick={startVerify} disabled={sendingCode}>
            {sendingCode ? 'שולחת קוד...' : 'אימות אימייל'}
          </button>
        </div>
      )}

      <p>
        <strong>{profile.name || 'שם חסר'}</strong> · {profile.phone || 'טלפון חסר'}
        <br />
        <small>הפרטים נלקחים מהחשבון שלך. <Link href="/account">עריכה באזור האישי</Link></small>
      </p>
      {incomplete && (
        <p className="error" role="alert">
          חסרים שם או טלפון בחשבון. <Link href="/account">להשלמה</Link>
        </p>
      )}

      <form onSubmit={onSubmit}>
        <label>עיר
          <CityInput defaultValue={profile.city ?? ''} required />
        </label>
        <label>רחוב ומספר בית
          <input name="address" required defaultValue={profile.address ?? ''} autoComplete="street-address" />
        </label>
        <label>הערות (לא חובה)<input name="notes" /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn" disabled={loading || items.length === 0 || incomplete || unverified}>
          {loading ? 'רגע...' : 'המשך לתשלום'}
        </button>
      </form>
    </main>
  );
}