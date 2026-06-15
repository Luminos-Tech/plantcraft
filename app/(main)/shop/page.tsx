'use client'

import type { ReactNode } from 'react'
import { useState, useMemo } from 'react'
import { Blocks, Coins, Glasses, Gift, LockKeyhole, Sparkles, Store, WandSparkles } from 'lucide-react'
import { ShopItem, SHOP_ITEMS, useGameStore } from '@/lib/store'
import { ShopItemCard } from '@/components/shop-item-card'
import { ItemDetailSheet } from '@/components/item-detail-sheet'
import { cn } from '@/lib/utils'

type FilterCategory = 'all' | ShopItem['category'] | 'rare'

const FILTER_OPTIONS: { value: FilterCategory; label: string; icon: ReactNode }[] = [
  { value: 'all', label: 'All', icon: <Gift className="h-3.5 w-3.5" /> },
  { value: 'hat', label: 'Hats', icon: <Sparkles className="h-3.5 w-3.5" /> },
  { value: 'glasses', label: 'Glasses', icon: <Glasses className="h-3.5 w-3.5" /> },
  { value: 'block', label: 'Blocks', icon: <Blocks className="h-3.5 w-3.5" /> },
  { value: 'vfx', label: 'Effects', icon: <WandSparkles className="h-3.5 w-3.5" /> },
  { value: 'rare', label: 'Rare', icon: <LockKeyhole className="h-3.5 w-3.5" /> },
]

export default function ShopPage() {
  const [selectedFilter, setSelectedFilter] = useState<FilterCategory>('all')
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null)
  const { coins } = useGameStore()

  const filteredItems = useMemo(() => {
    const shopItems = SHOP_ITEMS.filter((item) => !item.exclusive)
    if (selectedFilter === 'all') return shopItems
    if (selectedFilter === 'rare') {
      return shopItems.filter((item) => item.rarity === 'rare' || item.rarity === 'legendary')
    }
    return shopItems.filter((item) => item.category === selectedFilter)
  }, [selectedFilter])

  return (
    <div className="page-stack">
      <section className="page-hero">
        <div className="page-container flex flex-wrap items-center justify-between gap-3 py-4 sm:flex-nowrap sm:gap-4 sm:py-5">
          <div className="min-w-0">
            <span className="section-kicker font-pixel text-[8px]">
              <Store className="h-3.5 w-3.5" aria-hidden="true" />
              Item Market
            </span>
            <h2 className="text-balance mt-2.5 font-pixel text-sm text-foreground sm:text-base">Item Shop</h2>
            <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">Seasonal inventory</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-md border border-accent/35 bg-accent/12 px-3 py-2">
            <Coins className="h-5 w-5 text-accent" aria-hidden="true" />
            <span className="font-pixel text-xs text-accent">{coins} GC</span>
          </div>
        </div>
      </section>

      <div className="page-container pt-0">
        <div className="snap-scroll-x scrollbar-hide mb-4 flex min-w-0 max-w-full gap-2 overflow-x-auto pb-2 lg:flex-wrap lg:overflow-visible">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedFilter(option.value)}
              className={cn(
                'relative flex h-10 flex-shrink-0 items-center gap-1.5 rounded-md border-2 px-3 transition-all',
                selectedFilter === option.value
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border bg-card/88 text-foreground hover:border-primary/60 hover:bg-secondary/70'
              )}
            >
              {option.icon}
              <span className="font-pixel text-[8px]">{option.label}</span>
            </button>
          ))}
        </div>

        {filteredItems.length === 0 ? (
          <div className="surface-panel flex flex-col items-center justify-center py-16 text-center">
            <Store className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 font-pixel text-[10px] text-muted-foreground">
              No items in this category
            </p>
          </div>
        ) : (
          <div className="shop-grid">
            {filteredItems.map((item) => (
              <ShopItemCard
                key={item.id}
                item={item}
                onClick={() => setSelectedItem(item)}
              />
            ))}
          </div>
        )}
      </div>

      <ItemDetailSheet
        item={selectedItem}
        open={!!selectedItem}
        onOpenChange={(open) => !open && setSelectedItem(null)}
      />
    </div>
  )
}
