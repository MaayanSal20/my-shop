import { sql } from 'drizzle-orm';
import { db } from './index';
import { products } from './schema';
import initialProducts from '../products';

// מלאי התחלתי לכל מוצר (לפי id). למוצר 7 שמנו 0 כדי לראות איך נראה "אזל"
const stockById: Record<number, number> = { 1: 5, 2: 8, 3: 4, 4: 3, 5: 6, 6: 7, 7: 0, 8: 2 };

async function seed() {
  await db.execute(sql`truncate table products restart identity`);
  await db.insert(products).values(
    initialProducts.map(({ id, ...p }) => ({ ...p, stock: stockById[id] ?? 5 }))
  );
  console.log('נטענו', initialProducts.length, 'מוצרים');
  process.exit(0);
}

seed();