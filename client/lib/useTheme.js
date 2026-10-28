import { useEffect, useState } from 'react';
import { effectiveTheme, getStoredTheme, setTheme } from './theme';

export default function useTheme() {
  const [state, setState] = useState({ mounted: false, mode: 'system', effective: 'light' });

  useEffect(() => {
    const read = () =>
      setState({ mounted: true, mode: getStoredTheme(), effective: effectiveTheme() });
    read();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    window.addEventListener('themechange', read);
    mq.addEventListener('change', read);
    return () => {
      window.removeEventListener('themechange', read);
      mq.removeEventListener('change', read);
    };
  }, []);

  return { ...state, setMode: setTheme };
}