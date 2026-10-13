import Link from 'next/link';
import AuthNav from '../components/AuthNav';
import CartButton from '../components/CartButton';
import AddToCartButton from '../components/AddToCartButton';

const CATEGORIES = ['הכל', 'תכשיטים', 'תיקים', 'צעיפים', 'משקפיים'];

async function getProducts(category) {
  const query =
    category && category !== 'הכל'
      ? `?category=${encodeURIComponent(category)}`
      : '';
  const res = await fetch(`${process.env.API_URL}/api/products${query}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('לא הצלחנו לטעון מוצרים');
  return res.json();
}

export default async function Home({ searchParams }) {
  const { category = 'הכל' } = await searchParams;
  const products = await getProducts(category);

  return (
    <>
      <header className="topbar">
        <Link href="/" className="logo">myShop</Link>
        <div className="authnav">
          <AuthNav />
          <CartButton />
        </div>
      </header>

      <section className="hero">
        <h1>תכשיטים, תיקים וצעיפים שמלווים אותך כל היום</h1>
        <p>אוסף קטן של אקססוריז שנבחרו ביד.</p>
      </section>

      <nav className="filters">
        {CATEGORIES.map((c) => (
          <Link
            key={c}
            href={c === 'הכל' ? '/' : `/?category=${encodeURIComponent(c)}`}
            className={'chip' + (c === category ? ' active' : '')}
          >
            {c}
          </Link>
        ))}
      </nav>

      <main className="grid">
        {products.map((p) => (
          <article className={'card' + (p.stock === 0 ? ' soldout' : '')} key={p.id}>
            <div className="tile" style={{ background: p.color }}>
              <div className="tile" style={{ background: p.color }}>
                {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="tile-img" loading="lazy" />}
                {p.stock === 0 && <span className="badge">אזל</span>}
              </div>
              {p.stock === 0 && <span className="badge">אזל</span>}
            </div>
            <h3>{p.name}</h3>
            <div className="meta">
              <AddToCartButton productId={p.id} soldOut={p.stock === 0} />
              <span>{p.category}</span>
              <strong>₪{p.price}</strong>
            </div>
          </article>
        ))}
      </main>
    </>
  );
}