'use client';
import Link from 'next/link';
import { useCart } from './CartProvider';

export default function CartDrawer() {
  const { items, loggedIn, open, setOpen, error, total, setQty, remove } = useCart();

  return (
    <>
      <div className={'cart-shade' + (open ? ' on' : '')} onClick={() => setOpen(false)} />
      <aside className={'cart-drawer' + (open ? ' on' : '')} aria-label="עגלת קניות" aria-hidden={!open}>
        <div className="cart-head">
          <h2>העגלה שלך</h2>
          <button onClick={() => setOpen(false)} aria-label="סגירה">×</button>
        </div>

        {!loggedIn && (
          <p className="cart-empty">
            כדי לשמור פריטים בעגלה צריך <Link href="/login" onClick={() => setOpen(false)}>להתחבר</Link>.
          </p>
        )}
        {loggedIn && items.length === 0 && <p className="cart-empty">העגלה ריקה.</p>}
        {error && <p className="error" role="alert">{error}</p>}

        <div className="cart-items">
          {items.map((i) => (
            <div className="cart-row" key={i.productId}>
              <div className="cart-sw" style={{ background: i.color }} />
              <div className="cart-info">
                <strong>{i.name}</strong>
                <small>₪{i.price}</small>
                {i.stock === 0 && <small className="error">המוצר אזל, כדאי להסיר אותו</small>}
              </div>
              <div className="cart-qty">
                <button onClick={() => setQty(i.productId, i.quantity - 1)} aria-label="הפחתה">−</button>
                <span>{i.quantity}</span>
                <button
                  onClick={() => setQty(i.productId, i.quantity + 1)}
                  disabled={i.quantity >= i.stock}
                  aria-label="הוספה"
                >+</button>
              </div>
              <button className="cart-remove" onClick={() => remove(i.productId)} aria-label="הסרה">🗑</button>
            </div>
          ))}
        </div>

        {items.length > 0 && (
          <div className="cart-foot">
            <div className="cart-total"><span>סה״כ</span><strong>₪{total}</strong></div>
            <Link href="/checkout" className="btn" onClick={() => setOpen(false)}>לתשלום</Link>
          </div>
        )}
      </aside>
    </>
  );
}