'use client';
import { useRouter } from 'next/navigation';
import { useCart } from './CartProvider';

export default function AddToCartButton({ productId, soldOut }) {
  const router = useRouter();
  const { loggedIn, add } = useCart();

  if (soldOut) return <button className="add" disabled>אזל</button>;
  return (
    <button className="add" onClick={() => (loggedIn ? add(productId) : router.push('/login'))}>
      הוספה לעגלה
    </button>
  );
}