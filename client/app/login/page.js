'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const f = new FormData(e.currentTarget);
    const { ok, data } = await api('/api/auth/login', {
      method: 'POST',
      body: { email: f.get('email'), password: f.get('password') },
    });
    setLoading(false);
    if (!ok) return setError(data?.error ?? 'משהו השתבש, נסי שוב');
    router.push('/');
    router.refresh();
  }

  return (
    <main className="auth">
      <h1>התחברות</h1>
      <form onSubmit={onSubmit}>
        <label>אימייל<input name="email" type="email" required autoComplete="email" /></label>
        <label>סיסמה<input name="password" type="password" required autoComplete="current-password" /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn" disabled={loading}>{loading ? 'רגע...' : 'התחברות'}</button>
      </form>
      <p><Link href="/forgot-password">שכחתי סיסמה</Link></p>
      <p>אין לך חשבון? <Link href="/register">הרשמה</Link></p>
    </main>
  );
}