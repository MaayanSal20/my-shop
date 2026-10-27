'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from './CartProvider';

export default function AddToCartButton({ productId, soldOut }) {
  const router = useRouter();
  const { loggedIn, add } = useCart();
  const [added, setAdded] = useState(false);

  if (soldOut) return <button className="add" disabled>אזל מהמלאי</button>;

  async function onClick() {
    if (!loggedIn) return router.push('/login');
    await add(productId);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  }

  return (
    <button className="add" onClick={onClick} aria-live="polite">
      {added ? 'נוסף לעגלה ✓' : 'הוספה לעגלה'}
    </button>
  );
}