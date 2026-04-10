'use client'

import { useRouter } from 'next/navigation'
import { Plant, useGameStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PlantCardProps {
  plant: Plant
}

export function PlantCard({ plant }: PlantCardProps) {
  const router = useRouter()
  const { getPlantHp, waterPlant, wipePlant } = useGameStore()
  const hp = getPlantHp(plant.id)

  const getHpColor = () => {
    if (hp >= 70) return 'bg-[#4CAF50]'
    if (hp >= 40) return 'bg-[#FFC107]'
    return 'bg-[#F44336]'
  }

  const getStatus = () => {
    if (hp === 0) return { text: 'Need Help!', emoji: '💀', className: 'bg-destructive text-destructive-foreground' }
    if (hp < 20) return { text: 'Critical!', emoji: '🚨', className: 'bg-destructive text-destructive-foreground' }
    if (hp < 50) return { text: 'Thirsty', emoji: '💧', className: 'bg-[#FFC107] text-foreground' }
    return { text: 'Healthy', emoji: '✅', className: 'bg-primary text-primary-foreground' }
  }

  const status = getStatus()
  const hasDiagnosis = !!plant.pendingDiagnosis

  return (
    <div className={cn(
      'w-full rounded-sm border-2 bg-card p-3 transition-all',
      hasDiagnosis ? 'border-destructive' : 'border-primary',
      hp === 0 && 'animate-pulse opacity-80'
    )}>
      <div className="flex gap-3">
        {/* Plant Thumbnail */}
        <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-sm border border-border bg-muted">
          {plant.imageUrl ? (
            <img
              src={plant.imageUrl}
              alt={plant.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl">
              🌱
            </div>
          )}
          {/* Disease indicator */}
          {hasDiagnosis && (
            <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] animate-bounce">
              🦠
            </div>
          )}
        </div>

        {/* Plant Info */}
        <div className="flex flex-1 flex-col justify-between">
          {/* Name & Status */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-pixel text-xs text-foreground line-clamp-1">
              {plant.name}
            </h3>
            <span className={cn(
              'flex-shrink-0 rounded-sm px-1.5 py-0.5 font-pixel text-[6px]',
              status.className
            )}>
              {status.emoji} {status.text}
            </span>
          </div>

          {/* HP Bar */}
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="font-pixel text-[8px] text-muted-foreground">HP</span>
              <span className="font-pixel text-[8px] text-muted-foreground">{hp}/100</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-sm bg-muted">
              <div
                className={cn(
                  'h-full transition-all duration-500',
                  getHpColor(),
                  hp < 20 && 'animate-pulse-red'
                )}
                style={{ width: `${hp}%` }}
              />
            </div>
          </div>

          {/* Disease warning */}
          {hasDiagnosis && (
            <p className="mt-1 font-pixel text-[6px] text-destructive">
              🦠 {plant.pendingDiagnosis!.disease}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 font-pixel text-[8px] border-primary hover:bg-primary hover:text-primary-foreground"
          onClick={() => waterPlant(plant.id)}
        >
          💧 Water
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="font-pixel text-[8px] border-primary hover:bg-primary hover:text-primary-foreground"
          onClick={() => wipePlant(plant.id)}
        >
          🍃 Wipe
        </Button>
        <Button
          size="sm"
          className="flex-1 font-pixel text-[8px] bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => router.push(`/camera?plantId=${plant.id}`)}
        >
          ✨ AR
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="font-pixel text-[8px] border-accent text-accent hover:bg-accent hover:text-accent-foreground"
          onClick={() => router.push(`/plant/${plant.id}/qr`)}
        >
          📤
        </Button>
      </div>
    </div>
  )
}
