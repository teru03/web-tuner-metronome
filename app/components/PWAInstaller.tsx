'use client'

import { useEffect } from 'react'

export default function PWAInstaller() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' })
          .then(() => console.log('Service Worker registered'))
          .catch(err => console.log('SW registration failed:', err));
      });
    }
  }, []);

  return null
}