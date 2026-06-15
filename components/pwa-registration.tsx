'use client'

import { useEffect } from 'react'

export function PWARegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(console.warn)
    })
  }, [])

  return null
}
