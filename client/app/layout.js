import './globals.css';
import { Heebo } from 'next/font/google';
import CartProvider from '../components/CartProvider';
import CartDrawer from '../components/CartDrawer';
import SiteHeader from '../components/SiteHeader';

const heebo = Heebo({ subsets: ['hebrew', 'latin'], display: 'swap' });

export const metadata = {
  title: 'myShop',
  description: 'אקססוריז ותכשיטים',
};

// קובע את ערכת הנושא השמורה לפני הצביעה הראשונה (בלי הבהוב)
const themeScript = `try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl" className={heebo.className} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <CartProvider>
          <SiteHeader />
          {children}
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}