'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '../lib/api';
import { useCart } from './CartProvider';
import ThemeToggle from './ThemeToggle';

export default function AuthNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { reload } = useCart();
  const [user, setUser] = useState(undefined); // undefined = עדיין בודקים
  const lastKey = useRef(undefined); // מי הייתה מחוברת בבדיקה הקודמת

  // בודקים מי מחוברת בכל מעבר בין דפים, כדי שהכותרת והעגלה יתעדכנו מיד אחרי התחברות
  useEffect(() => {
    let cancelled = false;
    api('/api/auth/me').then(async ({ ok, data }) => {
      if (cancelled) return;
      const next = ok ? data : null;
      setUser(next);

      const key = next ? next.email : null;
      if (lastKey.current !== undefined && lastKey.current !== key) {
        await reload(); // התחברה או התנתקה: טוענים את העגלה מחדש
      }
      lastKey.current = key;
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    setUser(null);
    lastKey.current = null;
    await reload();
    router.push('/');
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
        <ThemeToggle />
      </nav>
    );
  }

  return (
    <nav className="authnav">
      <span>{user.email}</span>
      <Link href="/account">החשבון שלי</Link>
      {['staff', 'admin'].includes(user.role) && <Link href="/admin">ניהול</Link>}
      {!user.emailVerified && <button onClick={startVerify}>אימות אימייל</button>}
      <button onClick={logout}>התנתקות</button>
      <ThemeToggle />
    </nav>
  );
}