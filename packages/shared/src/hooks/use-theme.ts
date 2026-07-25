import { useCallback, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

function readTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem('sb_theme') as ThemeMode | null;
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function applyTheme(mode: ThemeMode) {
  document.documentElement.classList.toggle('dark', mode === 'dark');
  localStorage.setItem('sb_theme', mode);
  // Keep native form controls / scrollbars in sync
  document.documentElement.style.colorScheme = mode;
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(() => readTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Sync when another tab changes theme
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'sb_theme') return;
      if (e.newValue === 'light' || e.newValue === 'dark') {
        setThemeState(e.newValue);
        applyTheme(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    applyTheme(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      return next;
    });
  }, []);

  return { theme, setTheme, toggleTheme, isDark: theme === 'dark' };
}
