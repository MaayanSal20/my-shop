import { mkdirSync, writeFileSync } from 'node:fs';

const RID = '5c78e9fa-c2e2-4771-93ff-7f400a12f7ba';
const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=${RID}&limit=5000`;

const res = await fetch(url);
if (!res.ok) throw new Error('HTTP ' + res.status);
const { result } = await res.json();

const fields = result.fields.map((f) => f.id);
console.log('שדות במאגר:', fields.join(', '));

const nameField = fields.find(
  (f) => f.includes('שם') && f.includes('ישוב') && !/אנגלית|english/i.test(f)
);
if (!nameField) throw new Error('לא נמצא שדה שם ישוב, שלחי לי את רשימת השדות');

const names = [
  ...new Set(
    result.records
      .map((r) => String(r[nameField] ?? '').trim())
      .filter((n) => n && n !== 'לא רשום')
  ),
].sort((a, b) => a.localeCompare(b, 'he'));

console.log('נמצאו', names.length, 'ישובים. דוגמאות:', names.slice(0, 5).join(' | '));
if (names.length < 1000) throw new Error('מעט מדי ישובים, משהו לא תקין');

for (const dir of ['client/lib', 'server/data']) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/cities.json`, JSON.stringify(names));
}
console.log('נכתב ל-client/lib/cities.json ול-server/data/cities.json');