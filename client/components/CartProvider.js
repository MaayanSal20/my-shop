'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

const CartContext = createContext(null);
export const useCart = () => useContext(CartContext);

export default function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [loggedIn, setLoggedIn] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    const { ok, data } = await api('/api/cart');
    setLoggedIn(ok);
    setItems(ok ? data : []);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function add(productId) {
    setError('');
    const { ok, data } = await api('/api/cart/items', { method: 'POST', body: { productId } });
    if (!ok) {
      setError(data?.error ?? 'משהו השתבש');
      setOpen(true);
      return;
    }
    await reload();
    setOpen(true);
  }

  async function setQty(productId, quantity) {
    setError('');
    const { ok, data } = await api(`/api/cart/items/${productId}`, {
      method: 'PATCH',
      body: { quantity },
    });
    if (!ok) setError(data?.error ?? 'משהו השתבש');
    await reload();
  }

  async function remove(productId) {
    await api(`/api/cart/items/${productId}`, { method: 'DELETE' });
    await reload();
  }

  const count = items.reduce((t, i) => t + i.quantity, 0);
  const total = items.reduce((t, i) => t + i.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, loggedIn, open, setOpen, error, count, total, add, setQty, remove, reload }}
    >
      {children}
    </CartContext.Provider>
  );
}