'use client';
import useTheme from '../lib/useTheme';

const OPTIONS = [
  { value: 'system', label: 'לפי המכשיר' },
  { value: 'light', label: 'בהיר' },
  { value: 'dark', label: 'כהה' },
];

export default function ThemePreference() {
  const { mounted, mode, setMode } = useTheme();
  if (!mounted) return null;

  return (
    <fieldset className="pref">
      <legend>העדפות תצוגה</legend>
      {OPTIONS.map((o) => (
        <label key={o.value}>
          <input
            type="radio"
            name="theme"
            value={o.value}
            checked={mode === o.value}
            onChange={() => setMode(o.value)}
          />
          {o.label}
        </label>
      ))}
      <small>ההעדפה נשמרת במכשיר הזה.</small>
    </fieldset>
  );
}