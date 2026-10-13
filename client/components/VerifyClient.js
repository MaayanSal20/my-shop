'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';
import { useCart } from './CartProvider';

export default function VerifyClient({ email }) {
  const router = useRouter();
  const { reload } = useCart();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(60);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (!email) {
    return (
      <main className="auth">
        <h1>חסרה כתובת אימייל</h1>
        <p><Link href="/register">להרשמה</Link></p>
      </main>
    );
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    const { ok, data } = await api('/api/auth/verify', { method: 'POST', body: { email, code } });
    setLoading(false);
    if (!ok) return setError(data?.error ?? 'משהו השתבש, נסי שוב');
    await reload(); // מרענן את העגלה למשתמשת המחוברת
    router.push('/');
    router.refresh();
  }

  async function resend() {
    setError('');
    await api('/api/auth/resend-code', { method: 'POST', body: { email } });
    setCode('');
    setCooldown(60);
    setInfo('אם הכתובת רשומה, נשלח קוד חדש.');
  }

  return (
    <main className="auth">
      <h1>הזיני את קוד האימות</h1>
      <p>שלחנו קוד בן 6 ספרות אל <strong dir="ltr">{email}</strong></p>
      <form onSubmit={onSubmit}>
        <input
          className="code-input"
          dir="ltr"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          autoComplete="one-time-code"
          autoFocus
          aria-label="קוד אימות"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        />
        {error && <p className="error" role="alert">{error}</p>}
        {info && <p role="status">{info}</p>}
        <button className="btn" disabled={loading || code.length !== 6}>
          {loading ? 'רגע...' : 'אימות'}
        </button>
      </form>
      <p>
        לא קיבלת?{' '}
        {cooldown > 0 ? (
          <span>אפשר לבקש קוד חדש בעוד {cooldown} שניות</span>
        ) : (
          <button type="button" className="link-btn" onClick={resend}>שליחת קוד חדש</button>
        )}
      </p>
    </main>
  );
}