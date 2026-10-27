'use client';
import { CITIES } from '../lib/cities';

// שדה עיר עם השלמה מהרשימה הרשמית
export default function CityInput({ name = 'city', defaultValue = '', required = false }) {
  return (
    <>
      <input
        name={name}
        list="cities-list"
        defaultValue={defaultValue}
        required={required}
        autoComplete="off"
        placeholder="התחילי להקליד ובחרי מהרשימה"
      />
      <datalist id="cities-list">
        {CITIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </>
  );
}