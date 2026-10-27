'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const email = String(new FormData(e.currentTarget).get('email')).trim();
    const { ok, data } = await api('/api/auth/forgot-password', {
      method: 'POST',
      body: { email },
    });
    setLoading(false);
    if (!ok) return setError(data?.error ?? 'משהו השתבש, נסי שוב');
    router.push(`/reset-password?email=${encodeURIComponent(email)}`);
  }

  return (
    <main className="auth">
      <h1>שכחתי סיסמה</h1>
      <p>נכניס את האימייל שלך ונשלח אליו קוד לאיפוס הסיסמה.</p>
      <form onSubmit={onSubmit}>
        <label>אימייל
          <input name="email" type="email" required autoComplete="email" />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn" disabled={loading}>{loading ? 'רגע...' : 'שליחת קוד'}</button>
      </form>
      <p><Link href="/login">חזרה להתחברות</Link></p>
    </main>
  );
}