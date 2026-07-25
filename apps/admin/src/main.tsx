import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

// Restore theme before first paint (avoid light/dark flash). Shares the
// `sb_theme` key with the customer app so a single preference follows the user.
const savedTheme = localStorage.getItem('sb_theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
if (isDark) {
  document.documentElement.classList.add('dark');
}
document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
