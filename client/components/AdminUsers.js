'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';
import AdminNav from './AdminNav';

const ROLE_LABEL = { customer: 'לקוחה', staff: 'עובדת', admin: 'מנהלת' };

export default function AdminUsers() {
  const [me, setMe] = useState(undefined); // undefined = בודקים
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async (query) => {
    const { ok, data } = await api(`/api/admin/users?q=${encodeURIComponent(query)}`);
    if (!ok) return setError(data?.error ?? 'משהו השתבש');
    setUsers(data);
  }, []);

  useEffect(() => {
    api('/api/auth/me').then(({ ok, data }) => {
      setMe(ok ? data : null);
      if (ok && data.role === 'admin') load('');
    });
  }, [load]);

  if (me === undefined) return <main className="auth"><p>טוענת...</p></main>;

  if (!me || me.role !== 'admin') {
    return (
      <main className="auth">
        <h1>אין הרשאה</h1>
        <p>הדף הזה מיועד למנהלות בלבד.</p>
        <p><Link href={me ? '/' : '/login'}>{me ? 'חזרה לחנות' : 'להתחברות'}</Link></p>
      </main>
    );
  }

  async function changeRole(u, role) {
    if (role === u.role) return;
    if (!window.confirm(`לשנות את התפקיד של ${u.email} ל"${ROLE_LABEL[role]}"?`)) return;
    setError('');
    setNotice('');
    const { ok, data } = await api(`/api/admin/users/${u.id}/role`, {
      method: 'PATCH',
      body: { role },
    });
    if (!ok) setError(data?.error ?? 'משהו השתבש');
    else setNotice(`התפקיד של ${u.email} עודכן ✓`);
    await load(q);
  }

  function onSearch(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    load(q);
  }

  return (
    <main className="admin">
      <div className="admin-head">
        <h1>ניהול משתמשות</h1>
        <AdminNav role={me.role} current="/admin/users" />
      </div>

      <form className="users-search" onSubmit={onSearch}>
        <input
          type="search"
          placeholder="חיפוש לפי אימייל"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="חיפוש לפי אימייל"
        />
        <button className="btn">חיפוש</button>
      </form>

      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>אימייל</th><th>שם</th><th>אימייל מאומת</th><th>תפקיד</th></tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const self = u.id === me.id;
              return (
                <tr key={u.id}>
                  <td dir="ltr" style={{ textAlign: 'start' }}>{u.email}</td>
                  <td>{u.name || '—'}</td>
                  <td>{u.emailVerified ? '✓' : '—'}</td>
                  <td>
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u, e.target.value)}
                      disabled={self}
                      title={self ? 'אי אפשר לשנות את התפקיד של עצמך' : ''}
                      aria-label={`תפקיד של ${u.email}`}
                    >
                      {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    {self && <small> (את)</small>}
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && <tr><td colSpan={4}>לא נמצאו משתמשות.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}