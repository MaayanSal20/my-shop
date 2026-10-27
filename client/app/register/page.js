'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const f = new FormData(e.currentTarget);
    const email = String(f.get('email'));
    const { ok, data } = await api('/api/auth/register', {
      method: 'POST',
      body: {
        name: f.get('name'),
        email,
        phone: f.get('phone'),
        password: f.get('password'),
        marketingConsent: f.get('marketing') === 'on',
      },
    });
    setLoading(false);
    if (!ok) return setError(data?.error ?? 'משהו השתבש, נסי שוב');
    router.push(`/verify?email=${encodeURIComponent(email)}`);
  }

  return (
    <main className="auth">
      <h1>הרשמה</h1>
      <form onSubmit={onSubmit}>
        <label>שם מלא (פרטי ומשפחה)
          <input name="name" required autoComplete="name" />
        </label>
        <label>אימייל
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>טלפון נייד
          <input
            name="phone"
            type="tel"
            required
            inputMode="tel"
            autoComplete="tel"
            placeholder="050-1234567"
            pattern="[0-9+\-\s()]{9,16}"
            title="מספר נייד ישראלי, לדוגמה 050-1234567"
          />
        </label>
        <label>סיסמה (לפחות 8 תווים)
          <input name="password" type="password" required minLength={8} autoComplete="new-password" />
        </label>
        <label className="check">
          <input name="marketing" type="checkbox" />
          אני מאשרת קבלת הודעות ועדכונים בוואטסאפ ובאימייל
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn" disabled={loading}>{loading ? 'רגע...' : 'הרשמה'}</button>
      </form>
      <p>כבר רשומה? <Link href="/login">התחברות</Link></p>
    </main>
  );
}