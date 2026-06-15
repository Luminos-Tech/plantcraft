'use client'

import Link from 'next/link'
import { AlertOctagon, AlertTriangle, CheckCircle2, Paintbrush, Sparkles, Trash2, Users } from 'lucide-react'
import { FriendPlant, useGameStore } from '@/lib/store'

interface FriendPlantCardProps {
  friend: FriendPlant
}

export function FriendPlantCard({ friend }: FriendPlantCardProps) {
  const { removeFriendPlant } = useGameStore()

  const getHpColor = (hp: number) => {
    if (hp >= 70) return '#4CAF50'
    if (hp >= 40) return '#FFC107'
    return '#F44336'
  }

  const getStatusText = (hp: number) => {
    if (hp >= 70) return 'Healthy'
    if (hp >= 40) return 'Thirsty'
    return 'Critical'
  }

  const getStatusIcon = (hp: number) => {
    if (hp >= 70) return <CheckCircle2 className="h-3 w-3" />
    if (hp >= 40) return <AlertTriangle className="h-3 w-3" />
    return <AlertOctagon className="h-3 w-3" />
  }

  return (
    <div className="card-hover pixel-shadow group relative overflow-hidden rounded-lg border-2 border-border bg-card/95 p-3 hover:border-primary">
      <div className="friend-card-divider pointer-events-none absolute inset-x-0 top-0 h-[2px] opacity-70" />

      {/* Friend badge */}
      <div className="absolute right-2 top-2.5 flex items-center gap-1 rounded-full bg-[#8A6FE8]/15 px-1.5 py-0.5 font-pixel text-[6px] text-[#8A6FE8]">
        <Users className="h-2.5 w-2.5" aria-hidden="true" />
        FRIEND
      </div>

      <div className="flex items-center gap-3 pt-1">
        {/* Plant icon */}
        <div className="soft-preview-bg flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-border shadow-sm">
          <span className="text-2xl">🌿</span>
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1 pr-16">
          <h3 className="truncate font-pixel text-[10px] leading-relaxed text-foreground">
            {friend.name}
          </h3>
          {friend.description && (
            <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
              {friend.description}
            </p>
          )}

          {/* HP bar */}
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted ring-1 ring-border/70">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${friend.hp}%`,
                  background: getHpColor(friend.hp),
                }}
              />
            </div>
            <span className="flex shrink-0 items-center gap-1 font-pixel text-[8px]" style={{ color: getHpColor(friend.hp) }}>
              {getStatusIcon(friend.hp)} {getStatusText(friend.hp)}
            </span>
          </div>

          {/* Items count + last updated */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[8px] text-muted-foreground">
            {friend.placedItems?.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Paintbrush className="h-3 w-3" aria-hidden="true" />
                {friend.placedItems.length} items
              </span>
            )}
            <span>{new Date(friend.lastUpdated).toLocaleDateString('en-US')}</span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-3 grid grid-cols-[1fr_44px] gap-2">
        <Link
          href={`/camera?friendOwner=${friend.ownerUid}&friendPlant=${friend.plantId}`}
          className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-3 py-2 text-center font-pixel text-[8px] text-accent-foreground transition-colors hover:bg-accent/90"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          View AR
        </Link>
        <button
          onClick={() => removeFriendPlant(friend.id)}
          className="flex min-h-11 items-center justify-center rounded-md border border-border bg-card px-2 py-1.5 font-pixel text-[8px] text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
          aria-label={`Remove ${friend.name}`}
          title="Remove friend plant"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
