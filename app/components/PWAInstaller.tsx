'use client'

import { useEffect } from 'react'

export default function PWAInstaller() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(() => console.log('Service Worker registered'))
        .catch((error) => console.log('Service Worker registration failed:', error))
    }
  }, [])

  return null
}