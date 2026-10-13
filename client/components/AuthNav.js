'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';
import { useCart } from './CartProvider';

export default function AuthNav() {
  const router = useRouter();
  const { reload } = useCart();
  const [user, setUser] = useState(undefined); // undefined = עדיין בודקים

  useEffect(() => {
    api('/api/auth/me').then(({ ok, data }) => setUser(ok ? data : null));
  }, []);

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    setUser(null);
    await reload();
    router.refresh();
  }

  async function startVerify() {
    await api('/api/auth/resend-code', { method: 'POST', body: { email: user.email } });
    router.push(`/verify?email=${encodeURIComponent(user.email)}`);
  }

  if (user === undefined) return null;

  if (!user) {
    return (
      <nav className="authnav">
        <Link href="/login">התחברות</Link>
        <Link href="/register" className="chip active">הרשמה</Link>
      </nav>
    );
  }

  return (
    <nav className="authnav">
      <span>{user.email}</span>
      {['staff', 'admin'].includes(user.role) && <Link href="/admin">ניהול</Link>}
      {!user.emailVerified && <button onClick={startVerify}>אימות אימייל</button>}
      <button onClick={logout}>התנתקות</button>
    </nav>
  );
}