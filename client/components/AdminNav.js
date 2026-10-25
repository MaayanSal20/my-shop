import Link from 'next/link';

export default function AdminNav({ role, current }) {
  const links = [
    { href: '/admin', label: 'מוצרים' },
    { href: '/admin/orders', label: 'הזמנות' },
    ...(role === 'admin' ? [{ href: '/admin/users', label: 'משתמשות' }] : []),
    { href: '/', label: 'לחנות' },
  ];

  return (
    <nav className="admin-nav" aria-label="ניהול">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={l.href === current ? 'active' : ''}
          aria-current={l.href === current ? 'page' : undefined}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}