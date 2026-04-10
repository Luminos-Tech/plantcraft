'use client'

import { useState, useRef } from 'react'
import { ShopItem, SHOP_ITEMS, useGameStore, DiagnosisResult } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'
import { diagnosePlant, captureVideoFrame } from '@/lib/ai/diagnose-plant'

interface ARToolbarProps {
  plantId: string
  onScanComplete: (result: DiagnosisResult) => void
  videoRef?: React.RefObject<HTMLVideoElement | null>
}

export function ARToolbar({ plantId, onScanComplete, videoRef }: ARToolbarProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { ownedItems, equipItem, plants, setPendingDiagnosis } = useGameStore()

  const plant = plants.find((p) => p.id === plantId)
  const ownedShopItems = SHOP_ITEMS.filter((item) =>
    ownedItems.some((o) => o.itemId === item.id)
  )

  const handleScan = async () => {
    setIsScanning(true)
    setScanError(null)

    try {
      let imageBlob: Blob | null = null

      // Try to capture from video feed first
      if (videoRef?.current && videoRef.current.readyState >= 2) {
        imageBlob = await captureVideoFrame(videoRef.current)
      }

      if (!imageBlob) {
        // Fallback: open file picker
        fileInputRef.current?.click()
        setIsScanning(false)
        return
      }

      const plantName = plant?.name || 'Unknown Plant'
      const result = await diagnosePlant(imageBlob, plantName)

      if (result) {
        // Store diagnosis in plant state
        if (!result.isHealthy) {
          setPendingDiagnosis(plantId, result)
        }
        onScanComplete(result)
      } else {
        setScanError('AI could not analyze image. Try again!')
      }
    } catch {
      setScanError('Connection error. Please try again.')
    } finally {
      setIsScanning(false)
    }
  }

  // Handle file input fallback
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsScanning(true)
    setScanError(null)

    try {
      const plantName = plant?.name || 'Unknown Plant'
      const result = await diagnosePlant(file, plantName)

      if (result) {
        if (!result.isHealthy) {
          setPendingDiagnosis(plantId, result)
        }
        onScanComplete(result)
      } else {
        setScanError('AI could not analyze image. Try again!')
      }
    } catch {
      setScanError('Connection error. Please try again.')
    } finally {
      setIsScanning(false)
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleItemSelect = (item: ShopItem) => {
    if (selectedItemId === item.id) {
      setSelectedItemId(null)
    } else {
      setSelectedItemId(item.id)
      if (plant && !plant.equippedItems.includes(item.id)) {
        equipItem(plantId, item.id)
      }
    }
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999]"
      style={{
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(4px)',
        padding: '12px 16px',
      }}
    >
      {/* Hidden file input for fallback photo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Item Carousel */}
      {ownedShopItems.length > 0 && (
        <div className="mb-3 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {ownedShopItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleItemSelect(item)}
              className={cn(
                'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-sm border-2 transition-all',
                selectedItemId === item.id
                  ? 'border-accent bg-accent/20 scale-110'
                  : 'border-white/30 bg-white/10 hover:border-white/50'
              )}
            >
              <ItemThumb item={item} />
            </button>
          ))}
        </div>
      )}

      {/* Empty inventory message */}
      {ownedShopItems.length === 0 && (
        <p className="mb-3 text-center font-pixel text-[8px] text-white/70">
          Buy items from Shop to decorate!
        </p>
      )}

      {/* Error message */}
      {scanError && (
        <p className="mb-2 text-center font-pixel text-[8px] text-red-400">
          ⚠️ {scanError}
        </p>
      )}

      {/* AI Scan Button */}
      <Button
        onClick={handleScan}
        disabled={isScanning}
        className="w-full rounded-sm bg-primary font-pixel text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-70"
      >
        {isScanning ? (
          <span className="flex items-center gap-2">
            <Spinner className="h-4 w-4" />
            <span>AI analyzing...</span>
          </span>
        ) : (
          <span>🔍 AI Disease Scan</span>
        )}
      </Button>

      {/* Hint Text */}
      <p className="mt-2 text-center font-pixel text-[6px] text-white/50">
        Select item to place • Point camera at leaf to scan
      </p>
    </div>
  )
}

// Small item thumbnail
function ItemThumb({ item }: { item: ShopItem }) {
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
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      {item.category === 'hat' && (
        <>
          <rect x="10" y="16" width="12" height="3" fill={getItemColor()} />
          <rect x="12" y="13" width="8" height="3" fill={getItemColor()} />
        </>
      )}
      {item.category === 'glasses' && (
        <>
          <rect x="6" y="14" width="8" height="6" fill={getItemColor()} />
          <rect x="18" y="14" width="8" height="6" fill={getItemColor()} />
          <rect x="14" y="16" width="4" height="2" fill={getItemColor()} />
        </>
      )}
      {item.category === 'block' && (
        <rect x="10" y="10" width="12" height="12" fill={getItemColor()} />
      )}
      {item.category === 'vfx' && (
        <circle cx="16" cy="16" r="6" fill={getItemColor()} opacity="0.7" />
      )}
    </svg>
  )
}
