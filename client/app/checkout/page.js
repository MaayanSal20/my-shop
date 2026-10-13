'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { useCart } from '../../components/CartProvider';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, total, reload } = useCart();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const f = new FormData(e.currentTarget);
    const { ok, status, data } = await api('/api/checkout', {
      method: 'POST',
      body: Object.fromEntries(f.entries()),
    });
    setLoading(false);
    if (status === 401) return router.push('/login');
    if (!ok) {
      await reload();
      return setError(data?.error ?? 'משהו השתבש, נסי שוב');
    }
    await reload();
    router.push(`/order/${data.id}`);
  }

  return (
    <main className="auth">
      <h1>פרטי משלוח</h1>
      {items.length > 0 && (
        <p>{items.length} מוצרים בעגלה · סה״כ <strong>₪{total}</strong></p>
      )}
      <form onSubmit={onSubmit}>
        <label>שם מלא<input name="fullName" required autoComplete="name" /></label>
        <label>טלפון<input name="phone" type="tel" required autoComplete="tel" /></label>
        <label>עיר<input name="city" required autoComplete="address-level2" /></label>
        <label>רחוב ומספר בית<input name="address" required autoComplete="street-address" /></label>
        <label>הערות (לא חובה)<input name="notes" /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn" disabled={loading || items.length === 0}>
          {loading ? 'רגע...' : 'המשך לתשלום'}
        </button>
      </form>
    </main>
  );
}