'use client'

import { useGameStore, CareLog } from '@/lib/store'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'

interface CareHistorySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const ACTION_ICONS: Record<CareLog['action'], string> = {
  water: '💧',
  wipe: '🍃',
  fertilize: '🌿',
  scan: '🔍',
  decorate: '✨',
  cure: '💊',
}

const ACTION_LABELS: Record<CareLog['action'], string> = {
  water: 'Watering',
  wipe: 'Wiping leaves',
  fertilize: 'Fertilizing',
  scan: 'AI Scan',
  decorate: 'Decorating',
  cure: 'Curing',
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

export function CareHistorySheet({ open, onOpenChange }: CareHistorySheetProps) {
  const { careLogs, plants } = useGameStore()

  const getPlantName = (plantId: string) => {
    const plant = plants.find((p) => p.id === plantId)
    return plant?.name ?? 'Unknown Plant'
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-lg border-t-2 border-primary bg-card">
        <SheetHeader>
          <SheetTitle className="font-pixel text-sm text-primary">
            Care History
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            Your recent plant care activities
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 h-[calc(100%-80px)] overflow-y-auto">
          {careLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="text-4xl">📋</span>
              <p className="mt-2 font-pixel text-[10px] text-muted-foreground">
                No care history yet
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Start caring for your plants to see activities here
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {careLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center gap-3 rounded-sm border border-border bg-secondary/50 p-3"
                >
                  <span className="text-xl">{ACTION_ICONS[log.action]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-pixel text-[10px] text-foreground">
                      {ACTION_LABELS[log.action]}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {getPlantName(log.plantId)}
                      {log.notes && ` • ${log.notes}`}
                    </p>
                  </div>
                  <span className="flex-shrink-0 font-pixel text-[8px] text-muted-foreground">
                    {formatRelativeTime(log.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
