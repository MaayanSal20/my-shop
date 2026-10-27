import { readFileSync } from 'node:fs';

// הרשימה הרשמית של ישובים (נוצרה מ-data.gov.il)
const CITIES: string[] = JSON.parse(
  readFileSync(new URL('./data/cities.json', import.meta.url), 'utf8')
);
const CITY_SET = new Set(CITIES);

export function isKnownCity(value: unknown): value is string {
  return typeof value === 'string' && CITY_SET.has(value.trim());
}

// מחזיר טלפון נייד ישראלי בפורמט 05XXXXXXXX, או null אם לא תקין
export function normalizePhone(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  let p = input.replace(/[\s\-().]/g, '');
  if (p.startsWith('+972')) p = '0' + p.slice(4);
  else if (p.startsWith('972')) p = '0' + p.slice(3);
  return /^05\d{8}$/.test(p) ? p : null;
}

// שם מלא: לפחות שתי מילים, אותיות בלבד (וגרש, מקף, נקודה), עד 60 תווים
export function normalizeFullName(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const n = input.trim().replace(/\s+/g, ' ');
  if (n.length < 4 || n.length > 60) return null;
  if (!/^[\p{L}][\p{L} '’׳״"\-.]*$/u.test(n)) return null;
  return n.split(' ').length >= 2 ? n : null;
}