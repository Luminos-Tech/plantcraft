'use client'

import Link from 'next/link'
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

  const getStatusEmoji = (hp: number) => {
    if (hp >= 70) return '✅'
    if (hp >= 40) return '⚠️'
    return '🚨'
  }

  return (
    <div className="relative rounded-sm border-2 border-border bg-card p-3 transition-all hover:border-primary">
      {/* Friend badge */}
      <div className="absolute right-2 top-2 rounded-sm bg-purple-500/20 px-1.5 py-0.5 font-pixel text-[6px] text-purple-400">
        FRIEND
      </div>

      <div className="flex items-center gap-3">
        {/* Plant icon */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm border border-border bg-muted">
          <span className="text-2xl">🌿</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-pixel text-[10px] text-foreground truncate">
            {friend.name}
          </h3>

          {/* HP bar */}
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${friend.hp}%`,
                  background: getHpColor(friend.hp),
                }}
              />
            </div>
            <span className="font-pixel text-[8px] shrink-0" style={{ color: getHpColor(friend.hp) }}>
              {getStatusEmoji(friend.hp)} {getStatusText(friend.hp)}
            </span>
          </div>

          {/* Items count + last updated */}
          <div className="mt-1 flex items-center gap-2 text-[8px] text-muted-foreground">
            {friend.placedItems?.length > 0 && (
              <span>🎨 {friend.placedItems.length} items</span>
            )}
            <span>· {new Date(friend.lastUpdated).toLocaleDateString('en-US')}</span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-3 flex gap-2">
        <Link
          href={`/camera?friendOwner=${friend.ownerUid}&friendPlant=${friend.plantId}`}
          className="flex-1 rounded-sm bg-accent px-3 py-1.5 text-center font-pixel text-[8px] text-accent-foreground transition-colors hover:bg-accent/90"
        >
          🔮 View in AR
        </Link>
        <button
          onClick={() => removeFriendPlant(friend.id)}
          className="rounded-sm border border-border px-2 py-1.5 font-pixel text-[8px] text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
