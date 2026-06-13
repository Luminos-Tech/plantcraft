'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Droplets, Leaf, MoreVertical, Pencil, Send, Skull, Sparkles, Trash2 } from 'lucide-react'
import { CARE_ACTION_COOLDOWN_MS, Plant, useGameStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface PlantCardProps {
  plant: Plant
  compact?: boolean
  selected?: boolean
  className?: string
  onSelect?: () => void
  onEdit?: (plant: Plant) => void
}

const WIPE_ACTION_COOLDOWN_MS = CARE_ACTION_COOLDOWN_MS

export function PlantCard({ plant, compact = false, selected = false, className, onSelect, onEdit }: PlantCardProps) {
  const router = useRouter()
  const [now, setNow] = useState(() => Date.now())
  const [deleteOpen, setDeleteOpen] = useState(false)
  const { getPlantHp, waterPlant, wipePlant, removePlant } = useGameStore()
  const hp = getPlantHp(plant.id)
  const lastWatered = plant.lastWatered || plant.createdAt || now
  const lastWipedAt = plant.lastWipedAt || plant.createdAt || 0
  const waterReady = hp < 100 && now - lastWatered >= CARE_ACTION_COOLDOWN_MS
  const wipeReady = now - lastWipedAt >= WIPE_ACTION_COOLDOWN_MS

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(interval)
  }, [])

  const getHpColor = () => {
    if (hp >= 70) return 'bg-[#4CAF50]'
    if (hp >= 40) return 'bg-[#FFC107]'
    return 'bg-[#F44336]'
  }

  const getHpTextColor = () => {
    if (hp >= 70) return 'text-[#4CAF50]'
    if (hp >= 40) return 'text-[#FFC107]'
    return 'text-[#F44336]'
  }

  const getStatus = () => {
    if (hp === 0) return { text: 'Need Help!', icon: <Skull className="h-2.5 w-2.5" />, className: 'bg-destructive text-destructive-foreground' }
    if (hp < 20) return { text: 'Critical!', icon: <AlertTriangle className="h-2.5 w-2.5" />, className: 'bg-destructive text-destructive-foreground' }
    if (hp < 50) return { text: 'Thirsty', icon: <Droplets className="h-2.5 w-2.5" />, className: 'bg-[#FFC107] text-foreground' }
    return { text: 'Healthy', icon: <CheckCircle2 className="h-2.5 w-2.5" />, className: 'bg-primary text-primary-foreground' }
  }

  const status = getStatus()
  const hasDiagnosis = !!plant.pendingDiagnosis

  return (
    <>
      <div className={cn(
        'card-hover pixel-shadow group relative w-full overflow-hidden rounded-lg border-2 bg-card/95 p-3',
        !compact && 'sm:p-4',
        hasDiagnosis ? 'border-destructive' : 'border-primary/60 hover:border-primary',
        selected && 'ring-2 ring-primary/45 ring-offset-2 ring-offset-background',
        hp === 0 && 'animate-pulse opacity-85',
        onSelect && 'cursor-pointer',
        className
      )}
      onClick={onSelect}
      >
        <div className="absolute right-2 top-2 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                className="h-8 w-8 rounded-md border-primary/35 bg-card/95 text-foreground shadow-sm hover:bg-secondary"
                onClick={(event) => event.stopPropagation()}
                title="Plant settings"
                aria-label={`Settings for ${plant.name}`}
              >
                <MoreVertical className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-36 rounded-md">
              <DropdownMenuItem
                className="font-pixel text-[8px]"
                onSelect={() => {
                  onEdit?.(plant)
                }}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                className="font-pixel text-[8px]"
                onSelect={() => {
                  setDeleteOpen(true)
                }}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className={cn('flex gap-3 pr-8', !compact && 'sm:gap-4')}>
          {/* Plant Thumbnail */}
          <div className={cn(
            'relative aspect-square flex-shrink-0 overflow-hidden rounded-md border border-border bg-secondary',
            compact ? 'h-16 w-16 sm:h-20 sm:w-20' : 'h-20 w-20 sm:h-24 sm:w-24'
          )}>
            {plant.imageUrl ? (
              <img
                src={plant.imageUrl}
                alt={plant.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,var(--secondary),#ffffff)] text-3xl">
                🌱
              </div>
            )}
            {/* Disease indicator */}
            {hasDiagnosis && (
              <div className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm animate-bounce">
                <AlertTriangle className="h-3 w-3" />
              </div>
            )}
          </div>

          {/* Plant Info */}
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            {/* Name & Status */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className={cn(
                  'min-w-0 break-words font-pixel leading-relaxed text-foreground',
                  compact ? 'text-[10px]' : 'text-[11px] sm:text-xs'
                )}>
                  {plant.name}
                </h3>
                {plant.description && (
                  <p className={cn(
                    'mt-1 line-clamp-2 text-muted-foreground',
                    compact ? 'text-[10px] leading-snug' : 'text-xs leading-relaxed'
                  )}>
                    {plant.description}
                  </p>
                )}
              </div>
              <span className={cn(
                'flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-1 font-pixel text-[6px] shadow-sm',
                status.className
              )}>
                {status.icon} {status.text}
              </span>
            </div>

            {/* HP Bar */}
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="font-pixel text-[8px] text-muted-foreground">HP</span>
                <span className={cn('font-pixel text-[8px]', getHpTextColor())}>{hp}/100</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted ring-1 ring-border/70">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    getHpColor(),
                    hp < 20 && 'animate-pulse-red'
                  )}
                  style={{ width: `${hp}%` }}
                />
              </div>
            </div>

            {/* Disease warning */}
            {hasDiagnosis && !compact && (
              <p className="mt-1.5 flex items-center gap-1 line-clamp-1 font-pixel text-[6px] text-destructive">
                <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                {plant.pendingDiagnosis!.disease}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className={cn('mt-3 grid grid-cols-4 gap-1.5', !compact && 'sm:gap-2')}>
          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-md border-primary/60 bg-card font-pixel text-[8px] hover:bg-primary hover:text-primary-foreground disabled:border-border disabled:bg-muted/80 disabled:text-muted-foreground"
            onClick={(event) => {
              event.stopPropagation()
              waterPlant(plant.id)
            }}
            disabled={!waterReady}
            title="Water plant"
          >
            <Droplets className="h-3.5 w-3.5" aria-hidden="true" />
            <span className={cn('hidden', !compact && 'min-[420px]:inline')}>Water</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-md border-primary/60 bg-card font-pixel text-[8px] hover:bg-primary hover:text-primary-foreground disabled:border-border disabled:bg-muted/80 disabled:text-muted-foreground"
            onClick={(event) => {
              event.stopPropagation()
              wipePlant(plant.id)
            }}
            disabled={!wipeReady}
            title="Wipe leaves"
          >
            <Leaf className="h-3.5 w-3.5" aria-hidden="true" />
            <span className={cn('hidden', !compact && 'min-[420px]:inline')}>Wipe</span>
          </Button>
          <Button
            size="sm"
            className="h-10 rounded-md bg-primary font-pixel text-[8px] text-primary-foreground hover:bg-primary/90"
            onClick={(event) => {
              event.stopPropagation()
              router.push(`/camera?plantId=${plant.id}`)
            }}
            title="Open AR"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span className={cn('hidden', !compact && 'min-[420px]:inline')}>AR</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-md border-accent/70 bg-card font-pixel text-[8px] text-accent hover:bg-accent hover:text-accent-foreground"
            onClick={(event) => {
              event.stopPropagation()
              router.push(`/plant/${plant.id}/qr`)
            }}
            title="Share QR"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-lg border-2 border-destructive/60 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-pixel text-sm text-destructive">
              Delete {plant.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the plant and its saved decorations from your garden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-md font-pixel text-[9px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-md bg-destructive font-pixel text-[9px] text-destructive-foreground hover:bg-destructive/90"
              onClick={() => removePlant(plant.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
