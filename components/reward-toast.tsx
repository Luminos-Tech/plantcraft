'use client'

import { useEffect, useState, useCallback } from 'react'
import { Coins, Star } from 'lucide-react'

interface RewardEvent {
  xp: number
  coins: number
  action: string
}

interface ToastItem {
  id: string
  xp: number
  coins: number
  action: string
}

export function RewardToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const handleReward = useCallback((e: Event) => {
    const detail = (e as CustomEvent<RewardEvent>).detail
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, ...detail }])

    // Auto-remove after 2.5s
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 2500)
  }, [])

  useEffect(() => {
    window.addEventListener('plantcraft:reward', handleReward)
    return () => window.removeEventListener('plantcraft:reward', handleReward)
  }, [handleReward])

  if (toasts.length === 0) return null

  return (
    <div className="fixed left-0 right-0 top-20 z-[99999] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="reward-toast animate-reward-toast pointer-events-none rounded-md border-2 border-accent px-5 py-3 shadow-lg"
        >
          <div className="flex items-center gap-3">
            {/* XP indicator */}
            {toast.xp > 0 && (
              <span className="flex items-center gap-1 font-pixel text-xs text-accent">
                <Star className="h-3.5 w-3.5 fill-accent" aria-hidden="true" />
                +{toast.xp} XP
              </span>
            )}
            {/* Coins indicator */}
            {toast.coins > 0 && (
              <span className="flex items-center gap-1 font-pixel text-xs text-yellow-400">
                <Coins className="h-3.5 w-3.5" aria-hidden="true" />
                +{toast.coins} GC
              </span>
            )}
          </div>
          <p className="mt-1 text-center font-pixel text-[8px] text-white/70">
            {toast.action}
          </p>
        </div>
      ))}
    </div>
  )
}
