'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '../lib/api';

export default function ResetClient() {
  const params = useSearchParams();
  const email = params.get('email') ?? '';
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const f = new FormData(e.currentTarget);
    const { ok, data } = await api('/api/auth/reset-password', {
      method: 'POST',
      body: {
        email: f.get('email'),
        code: String(f.get('code')).trim(),
        password: f.get('password'),
      },
    });
    setLoading(false);
    if (!ok) return setError(data?.error ?? 'משהו השתבש, נסי שוב');
    setDone(true);
  }

  if (done) {
    return (
      <main className="auth">
        <h1>הסיסמה עודכנה</h1>
        <p role="status">אפשר להתחבר עכשיו עם הסיסמה החדשה.</p>
        <Link className="btn" href="/login">להתחברות</Link>
      </main>
    );
  }

  return (
    <main className="auth">
      <h1>איפוס סיסמה</h1>
      <p>שלחנו קוד בן 6 ספרות לאימייל, אם הוא רשום אצלנו. הקוד תקף ל-10 דקות.</p>
      <form onSubmit={onSubmit}>
        <label>אימייל
          <input name="email" type="email" required defaultValue={email} autoComplete="email" />
        </label>
        <label>קוד מהאימייל
          <input
            name="code"
            className="code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
          />
        </label>
        <label>סיסמה חדשה (לפחות 8 תווים)
          <input name="password" type="password" required minLength={8} autoComplete="new-password" />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn" disabled={loading}>{loading ? 'רגע...' : 'עדכון סיסמה'}</button>
      </form>
      <p><Link href="/forgot-password">לא הגיע קוד? לשלוח שוב</Link></p>
    </main>
  );
}