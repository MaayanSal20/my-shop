import cities from './cities.json';

const set = new Set(cities);

export const CITIES = cities;
export const isKnownCity = (v) => set.has(String(v ?? '').trim());