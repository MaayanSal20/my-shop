import 'dotenv/config';
import crypto from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const BUCKET = 'product-images';
let client: SupabaseClient | null = null;

function sb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    // מדפיסים רק שמות ומצב, אף פעם לא ערכים
    console.error('[storage] SUPABASE_URL קיים:', Boolean(url), '| SUPABASE_SECRET_KEY קיים:', Boolean(key));
    console.error('[storage] משתני סביבה שמתחילים ב-SUPABASE:', Object.keys(process.env).filter((k) => k.toUpperCase().includes('SUPABASE')));
    throw new Error('חסר משתנה סביבה של Supabase (פרטים למעלה)');
  }
   const origin = new URL(url).origin; // משאיר רק https://xxxx.supabase.co
  client ??= createClient(origin, key, { auth: { persistSession: false } });
  return client;
}

// בודקים את תוכן הקובץ עצמו ולא רק את הסיומת או הסוג שהדפדפן דיווח
export function detectImage(buf: Buffer): { ext: string; mime: string } | null {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  if (
    buf.length > 12 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (
    buf.length > 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
}

export async function uploadProductImage(buf: Buffer, ext: string, mime: string) {
  const path = `${crypto.randomUUID()}.${ext}`; // שם אקראי, לא שם הקובץ של המשתמשת
  const { error } = await sb().storage.from(BUCKET).upload(path, buf, {
    contentType: mime,
    cacheControl: '31536000',
  });
  if (error) throw error;
  return sb().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}