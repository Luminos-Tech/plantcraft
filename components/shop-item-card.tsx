'use client'

import { Check, Coins } from 'lucide-react'
import { ShopItem, useGameStore } from '@/lib/store'
import { cn } from '@/lib/utils'

interface ShopItemCardProps {
  item: ShopItem
  onClick: () => void
}

// Simple isometric placeholder icons for items
const ItemPreview = ({ item }: { item: ShopItem }) => {
  const getItemColor = () => {
    switch (item.category) {
      case 'hat': return '#E8C547'
      case 'glasses': return '#5C8A3C'
      case 'block': return '#8B7355'
      case 'vfx': return '#A855F7'
      default: return '#5C8A3C'
    }
  }

  return (
    <div className="flex h-20 w-20 items-center justify-center">
      <svg width="64" height="64" viewBox="0 0 32 32" fill="none" className="drop-shadow-sm transition-transform duration-300 group-hover:scale-110">
        {item.category === 'hat' && (
          <>
            <rect x="8" y="16" width="16" height="4" fill={getItemColor()} />
            <rect x="10" y="12" width="12" height="4" fill={getItemColor()} />
            <rect x="12" y="8" width="8" height="4" fill={getItemColor()} />
            <rect x="8" y="16" width="16" height="1" fill="#FFF" opacity="0.3" />
          </>
        )}
        {item.category === 'glasses' && (
          <>
            <rect x="4" y="12" width="10" height="8" fill={getItemColor()} />
            <rect x="18" y="12" width="10" height="8" fill={getItemColor()} />
            <rect x="14" y="14" width="4" height="4" fill={getItemColor()} />
            <rect x="6" y="14" width="6" height="4" fill="#1a1a1a" />
            <rect x="20" y="14" width="6" height="4" fill="#1a1a1a" />
          </>
        )}
        {item.category === 'block' && (
          <>
            <rect x="8" y="8" width="16" height="16" fill={getItemColor()} />
            <rect x="8" y="8" width="16" height="4" fill="#FFF" opacity="0.2" />
            <rect x="8" y="8" width="4" height="16" fill="#FFF" opacity="0.1" />
            <rect x="20" y="8" width="4" height="16" fill="#000" opacity="0.2" />
          </>
        )}
        {item.category === 'vfx' && (
          <>
            <circle cx="16" cy="16" r="10" fill={getItemColor()} opacity="0.3" />
            <circle cx="16" cy="16" r="6" fill={getItemColor()} opacity="0.5" />
            <circle cx="16" cy="16" r="3" fill={getItemColor()} />
            <rect x="10" y="8" width="2" height="2" fill="#FFF" />
            <rect x="20" y="12" width="2" height="2" fill="#FFF" />
            <rect x="14" y="22" width="2" height="2" fill="#FFF" />
          </>
        )}
      </svg>
    </div>
  )
}

export function ShopItemCard({ item, onClick }: ShopItemCardProps) {
  const { coins, ownedItems } = useGameStore()
  const isOwned = ownedItems.some((o) => o.itemId === item.id)
  const canAfford = coins >= item.price

  const isNew = () => {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    return new Date(item.createdAt) > sevenDaysAgo
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'card-hover pixel-shadow group relative flex min-w-0 flex-col items-center overflow-hidden rounded-lg border-2 bg-card/95 p-2.5 text-left active:scale-[0.98] sm:min-h-[180px] sm:p-3',
        isOwned ? 'border-primary/60' : canAfford ? 'border-border' : 'border-border opacity-80'
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-[linear-gradient(90deg,var(--primary),var(--accent),#6BA6FF)] opacity-70" />

      {/* Badges */}
      <div className="absolute left-2 top-2.5 flex flex-col gap-1">
        {isNew() && (
          <span className="rounded-full bg-accent px-1.5 py-0.5 font-pixel text-[6px] text-accent-foreground shadow-sm">
            NEW
          </span>
        )}
        {item.rarity === 'rare' && (
          <span className="rounded-full bg-[#8A6FE8] px-1.5 py-0.5 font-pixel text-[6px] text-white shadow-sm">
            RARE
          </span>
        )}
        {item.rarity === 'legendary' && (
          <span className="rounded-full bg-gradient-to-r from-amber-400 to-rose-500 px-1.5 py-0.5 font-pixel text-[6px] text-white shadow-sm">
            LEGEND
          </span>
        )}
      </div>

      {/* Owned Badge */}
      {isOwned && (
        <div className="absolute right-2 top-2.5 flex items-center gap-1 rounded-full bg-primary px-1.5 py-0.5 font-pixel text-[6px] text-primary-foreground shadow-sm">
          <Check className="h-2.5 w-2.5" aria-hidden="true" />
          OWNED
        </div>
      )}

      {/* Item Preview */}
      <div className="mt-4 flex h-20 w-full items-center justify-center rounded-md bg-[linear-gradient(135deg,var(--secondary),#ffffff)] ring-1 ring-border/60 sm:h-24">
        <ItemPreview item={item} />
      </div>

      {/* Item Name */}
      <h3 className="mt-3 min-h-8 w-full text-center font-pixel text-[7px] leading-relaxed text-foreground line-clamp-2 sm:text-[8px]">
        {item.name}
      </h3>

      {/* Price — with top separator */}
      <div className="mt-auto w-full border-t border-border/60 pt-2">
        <div className={cn(
          'flex items-center justify-center gap-1 font-pixel text-[9px] sm:text-[10px]',
          isOwned ? 'text-primary' : canAfford ? 'text-accent' : 'text-muted-foreground'
        )}>
          {isOwned ? (
            <span>Owned</span>
          ) : (
            <>
              <Coins className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{item.price} GC</span>
            </>
          )}
        </div>
      </div>
    </button>
  )
}
