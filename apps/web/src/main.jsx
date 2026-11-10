import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { applyTheme, loadTheme } from './theme/theme';

// Set the theme before the first render so the page never flashes the wrong one.
applyTheme(loadTheme());

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// The service worker keeps the app itself loadable without a connection, so
// the offline read-only view works after a reload. It is not an installable
// app (no manifest, no install prompt) and never caches data; see public/sw.js.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}
