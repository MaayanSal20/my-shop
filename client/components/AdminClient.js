'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, uploadFile } from '../lib/api';
import AdminNav from './AdminNav';

const CATEGORIES = ['תכשיטים', 'תיקים', 'צעיפים', 'משקפיים'];
const EMPTY = { name: '', category: CATEGORIES[0], price: '', stock: '', color: '#E4DDD3' };

export default function AdminClient() {
  const [user, setUser] = useState(undefined); // undefined = בודקים
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null); // null = מצב הוספה
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const { ok, data } = await api('/api/products');
    if (ok) setItems(data);
  }, []);

  useEffect(() => {
    api('/api/auth/me').then(({ ok, data }) => {
      setUser(ok ? data : null);
      if (ok && ['staff', 'admin'].includes(data.role)) load();
    });
  }, [load]);

  if (user === undefined) return <main className="auth"><p>טוענת...</p></main>;

  if (!user || !['staff', 'admin'].includes(user.role)) {
    return (
      <main className="auth">
        <h1>אין הרשאה</h1>
        <p>הדף הזה מיועד לעובדים ומנהלים בלבד.</p>
        <p><Link href={user ? '/' : '/login'}>{user ? 'חזרה לחנות' : 'להתחברות'}</Link></p>
      </main>
    );
  }

  const isAdmin = user.role === 'admin';
  const editing = items.find((p) => p.id === editId);
  // מוצר שאזל: רק מנהל יכול להוסיף לו מלאי (השרת אוכף את זה גם הוא)
  const stockLocked = Boolean(editing && editing.stock === 0 && !isAdmin);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function startEdit(p) {
    setEditId(p.id);
    setForm({
      name: p.name,
      category: p.category,
      price: String(p.price),
      stock: String(p.stock),
      color: p.color,
    });
    setError('');
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function reset() {
    setEditId(null);
    setForm(EMPTY);
    setError('');
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    setSaving(true);

    const body = {
      name: form.name,
      category: form.category,
      price: Number(form.price),
      color: form.color,
    };
    if (!stockLocked) body.stock = Number(form.stock);

    const { ok, data } = editId
      ? await api(`/api/admin/products/${editId}`, { method: 'PATCH', body })
      : await api('/api/admin/products', { method: 'POST', body });

    setSaving(false);
    if (!ok) return setError(data?.error ?? 'משהו השתבש');

    setNotice(editId ? 'המוצר עודכן ✓' : 'המוצר נוסף ✓');
    reset();
    await load();
  }

  async function onPickImage(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // מאפשר לבחור שוב את אותו קובץ
    if (!file || !editId) return;
    setError('');
    setNotice('');
    setUploading(true);
    const { ok, data } = await uploadFile(`/api/admin/products/${editId}/image`, file);
    setUploading(false);
    if (!ok) return setError(data?.error ?? 'ההעלאה נכשלה');
    setNotice('התמונה הועלתה ✓');
    await load();
  }

  async function onDeleteImage() {
    if (!editId) return;
    if (!window.confirm('למחוק את התמונה? אי אפשר לבטל.')) return;
    setError('');
    setNotice('');
    setUploading(true);
    const { ok, data } = await api(`/api/admin/products/${editId}/image`, { method: 'DELETE' });
    setUploading(false);
    if (!ok) return setError(data?.error ?? 'המחיקה נכשלה');
    setNotice('התמונה נמחקה ✓');
    await load();
  }

  async function remove(p) {
    if (!window.confirm(`למחוק את "${p.name}"? אי אפשר לבטל.`)) return;
    setError('');
    setNotice('');
    const { ok, data } = await api(`/api/admin/products/${p.id}`, { method: 'DELETE' });
    if (!ok) return setError(data?.error ?? 'משהו השתבש');
    if (editId === p.id) reset();
    setNotice('המוצר נמחק ✓');
    await load();
  }

  return (
    <main className="admin">
      <div className="admin-head">
        <h1>ניהול מוצרים</h1>
        <span>{user.email} · {isAdmin ? 'מנהל' : 'עובד'}</span>
        <AdminNav role={user.role} current="/admin" />
      </div>

      <form className="admin-form" onSubmit={onSubmit}>
        <h2>{editId ? `עריכת מוצר #${editId}` : 'מוצר חדש'}</h2>
        <label>שם<input value={form.name} onChange={set('name')} required maxLength={100} /></label>
        <label>קטגוריה
          <input value={form.category} onChange={set('category')} list="cats" required maxLength={40} />
          <datalist id="cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        <label>מחיר (₪)
          <input type="number" min="0" max="100000" step="1" value={form.price} onChange={set('price')} required />
        </label>
        <label>מלאי
          <input
            type="number" min="0" max="100000" step="1"
            value={form.stock} onChange={set('stock')} required
            disabled={stockLocked}
          />
          {stockLocked && <small>המוצר אזל. רק מנהל יכול להוסיף לו מלאי.</small>}
        </label>
        <label>צבע (כשאין תמונה)
          <input type="color" value={form.color} onChange={set('color')} />
        </label>

        {editId ? (
          <div className="admin-image">
            {editing?.imageUrl ? (
              <>
                <img src={editing.imageUrl} alt="" className="admin-thumb" />
                <div className="admin-actions">
                  <button
                    type="button"
                    className="link-btn danger"
                    onClick={onDeleteImage}
                    disabled={uploading}
                  >
                    מחיקת התמונה
                  </button>
                </div>
              </>
            ) : (
              <small>אין תמונה, ולכן יוצג הצבע שנבחר.</small>
            )}
            <label>
              {editing?.imageUrl ? 'החלפת תמונה' : 'הוספת תמונה'} (JPG, PNG או WebP, עד 3MB)
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onPickImage} disabled={uploading} />
            </label>
            {uploading && <small>רגע...</small>}
          </div>
        ) : (
          <small>אפשר להעלות תמונה אחרי שהמוצר נשמר, דרך "עריכה".</small>
        )}

        {error && <p className="error" role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}

        <div className="admin-actions">
          <button className="btn" disabled={saving}>{saving ? 'שומרת...' : editId ? 'שמירת שינויים' : 'הוספת מוצר'}</button>
          {editId && <button type="button" className="link-btn" onClick={reset}>ביטול עריכה</button>}
        </div>
      </form>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th></th><th>שם</th><th>קטגוריה</th><th>מחיר</th><th>מלאי</th><th></th></tr>
          </thead>
          <tbody>
            {items.map((p) => {
              const soldOutLocked = p.stock === 0 && !isAdmin;
              return (
                <tr key={p.id}>
                  <td>
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" className="admin-sw" />
                    ) : (
                      <span className="admin-sw" style={{ background: p.color }} />
                    )}
                  </td>
                  <td>{p.name}</td>
                  <td>{p.category}</td>
                  <td>₪{p.price}</td>
                  <td>{p.stock === 0 ? <strong className="error">אזל</strong> : p.stock}</td>
                  <td className="admin-row-actions">
                    <button onClick={() => startEdit(p)}>עריכה</button>
                    <button
                      onClick={() => remove(p)}
                      disabled={soldOutLocked}
                      title={soldOutLocked ? 'רק מנהל יכול להסיר מוצר שאזל' : ''}
                    >מחיקה</button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && <tr><td colSpan={6}>אין מוצרים עדיין.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}