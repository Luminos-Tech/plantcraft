'use client'

import { ClipboardList, Droplets, Leaf, Pill, ScanLine, Sparkles, TreeDeciduous } from 'lucide-react'
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

const ACTION_ICONS: Record<CareLog['action'], React.ReactNode> = {
  water: <Droplets className="h-4 w-4 text-blue-500" />,
  wipe: <Leaf className="h-4 w-4 text-green-600" />,
  fertilize: <TreeDeciduous className="h-4 w-4 text-green-500" />,
  scan: <ScanLine className="h-4 w-4 text-purple-500" />,
  decorate: <Sparkles className="h-4 w-4 text-amber-500" />,
  cure: <Pill className="h-4 w-4 text-pink-500" />,
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
      <SheetContent side="bottom" className="h-[65vh] rounded-t-lg border-t-2 border-primary bg-card/98 shadow-2xl sm:h-[55vh]">
        <SheetHeader>
          <SheetTitle className="font-pixel text-sm text-primary">
            Care History
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            Recent activity
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 h-[calc(100%-80px)] overflow-y-auto scrollbar-hide">
          {careLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ClipboardList className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
              <p className="mt-2 font-pixel text-[10px] text-muted-foreground">
                No care history yet
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {careLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-secondary/50 p-3 shadow-sm transition-colors hover:bg-secondary/70"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-card ring-1 ring-border">
                    {ACTION_ICONS[log.action]}
                  </span>
                  <div className="min-w-0 flex-1">
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
