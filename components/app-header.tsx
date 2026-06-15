'use client'

import { Activity, Coins, Leaf, ShieldCheck, Star } from 'lucide-react'
import { useGameStore } from '@/lib/store'
import { APP_VERSION } from '@/lib/version'

export function AppHeader() {
  const { coins, level, xp, plants, getPlantHp } = useGameStore()
  const xpProgress = Math.max(0, Math.min(100, (xp / 100) * 100))
  const alertCount = plants.filter((plant) => getPlantHp(plant.id) < 40 || plant.pendingDiagnosis).length
  const statusLabel = alertCount > 0 ? `${alertCount} alert${alertCount > 1 ? 's' : ''}` : 'Stable'

  return (
    <header className="app-header sticky top-0 z-40 border-b border-primary/20 bg-card/88 px-3 py-2 shadow-sm backdrop-blur-xl sm:px-4">
      <div className="mx-auto w-full max-w-[1180px]">
        <div className="flex items-center justify-between gap-3">
          {/* Logo */}
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="brand-mark flex h-8 w-8 shrink-0 items-center justify-center rounded-md border-2 border-primary bg-primary text-primary-foreground shadow-sm">
              <Leaf className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                <h1 className="truncate font-pixel text-xs text-primary sm:text-sm">
                  PlantCraft
                </h1>
                <span className="shrink-0 rounded border border-primary/20 bg-secondary/70 px-1 py-0.5 font-pixel text-[6px] leading-none text-muted-foreground">
                  v{APP_VERSION}
                </span>
              </div>
              <div className="mt-1 hidden items-center gap-1.5 text-muted-foreground sm:flex">
                {alertCount > 0 ? (
                  <Activity className="h-3 w-3 text-destructive" aria-hidden="true" />
                ) : (
                  <ShieldCheck className="h-3 w-3 text-primary" aria-hidden="true" />
                )}
                <span className="font-pixel text-[6px]">{statusLabel}</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
            {/* Coins */}
            <div className="hud-stat-chip border-accent/35 bg-accent/12">
              <Coins className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              <span className="font-pixel text-[9px] text-accent sm:text-[10px]">{coins}</span>
              <span className="hidden font-pixel text-[7px] text-muted-foreground sm:inline">GC</span>
            </div>

            {/* Level */}
            <div className="hud-stat-chip border-primary/20 bg-secondary/70">
              <Star className="h-3.5 w-3.5 fill-accent text-accent" aria-hidden="true" />
              <span className="font-pixel text-[9px] text-foreground sm:text-[10px]">LV {level}</span>
            </div>
          </div>
        </div>

        {/* XP Progress Bar */}
        <div className="mt-2 flex items-center gap-2">
          <span className="hidden font-pixel text-[7px] text-muted-foreground sm:inline">XP</span>
          <div className="xp-track flex-1 overflow-hidden rounded-full border border-border bg-muted">
            <div
              className="xp-fill h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${xpProgress}%` }}
            />
          </div>
        </div>
      </div>
    </header>
  )
}
