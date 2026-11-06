import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
// In development, unregister any stale service workers to prevent iframe reload loops and glitching
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  }).catch(() => {});
} else if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // In production, register the service worker for 100% offline functionality
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[PWA] ServiceWorker registration notice:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
