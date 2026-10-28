'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '../lib/api';
import { useCart } from './CartProvider';
import CartButton from './CartButton';
import ThemeToggle from './ThemeToggle';

const BARS = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const CLOSE = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export default function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { reload } = useCart();
  const [user, setUser] = useState(undefined); // undefined = עדיין בודקים
  const [open, setOpen] = useState(false);
  const lastKey = useRef(undefined); // מי הייתה מחוברת בבדיקה הקודמת
  const menuRef = useRef(null);
  const btnRef = useRef(null);

  // בודקים מי מחוברת בכל מעבר בין דפים, כדי שהתפריט והעגלה יתעדכנו מיד אחרי התחברות
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

  // התפריט נסגר במעבר דף
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // סגירה בלחיצה בחוץ וב-Esc
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function logout() {
    setOpen(false);
    await api('/api/auth/logout', { method: 'POST' });
    setUser(null);
    lastKey.current = null;
    await reload();
    router.push('/');
    router.refresh();
  }

  async function startVerify() {
    setOpen(false);
    await api('/api/auth/resend-code', { method: 'POST', body: { email: user.email } });
    router.push(`/verify?email=${encodeURIComponent(user.email)}`);
  }

  return (
    <header className="topbar">
      <div className="topbar-start">
        <div className="menu" ref={menuRef}>
          <button
            ref={btnRef}
            type="button"
            className="menu-btn"
            aria-label="תפריט"
            aria-expanded={open}
            aria-controls="site-menu"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? CLOSE : BARS}
          </button>

          {open && (
            <div id="site-menu" className="menu-panel">
              {user === undefined && <span className="menu-email">טוענת...</span>}

              {user === null && (
                <>
                  <Link href="/login">התחברות</Link>
                  <Link href="/register">הרשמה</Link>
                </>
              )}

              {user && (
                <>
                  <span className="menu-email">{user.email}</span>
                  <Link href="/account">החשבון שלי</Link>
                  {['staff', 'admin'].includes(user.role) && <Link href="/admin">ניהול</Link>}
                  {!user.emailVerified && (
                    <button type="button" onClick={startVerify}>אימות אימייל</button>
                  )}
                  <button type="button" onClick={logout}>התנתקות</button>
                </>
              )}
            </div>
          )}
        </div>

        <Link href="/" className="logo">myShop</Link>
      </div>

      <div className="topbar-end">
        <ThemeToggle />
        <CartButton />
      </div>
    </header>
  );
}