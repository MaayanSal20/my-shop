'use client';
import { useCart } from './CartProvider';

export default function CartButton() {
  const { count, setOpen } = useCart();
  return (
    <button className="cartbtn" onClick={() => setOpen(true)} aria-label="פתיחת העגלה">
      העגלה<b>{count}</b>
    </button>
  );
}