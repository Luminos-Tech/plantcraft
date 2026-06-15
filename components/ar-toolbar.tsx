'use client'

import { useRef, useState, type ReactNode } from 'react'
import {
  EyeOff,
  ImageUp,
  PanelBottomOpen,
  ScanLine,
  Sparkles,
  Trash2,
  Camera,
} from 'lucide-react'
import { ShopItem, SHOP_ITEMS, useGameStore, DiagnosisResult } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'
import { diagnosePlant, captureVideoFrame } from '@/lib/ai/diagnose-plant'
import type { ARFrameState } from '@/lib/filter/filter-engine'

interface ARToolbarProps {
  plantId: string
  onScanComplete: (result: DiagnosisResult) => void
  videoRef?: React.RefObject<HTMLVideoElement | null>
  selectedItemId: string | null
  onItemSelected: (itemId: string | null) => void
  deleteMode: boolean
  onDeleteModeChange: (mode: boolean) => void
  arState: ARFrameState
  onPlaceSelected: () => void
  onCapturePlantPhoto?: () => void
  isPlantPhotoSaving?: boolean
  plantPhotoStatus?: string | null
}

export function ARToolbar({
  plantId,
  onScanComplete,
  videoRef,
  selectedItemId,
  onItemSelected,
  deleteMode,
  onDeleteModeChange,
  arState,
  onPlaceSelected,
  onCapturePlantPhoto,
  isPlantPhotoSaving = false,
  plantPhotoStatus,
}: ARToolbarProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { ownedItems, plants, setPendingDiagnosis } = useGameStore()

  const plant = plants.find((p) => p.id === plantId)
  const ownedShopItems = SHOP_ITEMS.filter((item) =>
    ownedItems.some((owned) => owned.itemId === item.id)
  )

  const handleScan = async () => {
    setIsPanelOpen(true)
    setIsScanning(true)
    setScanError(null)

    try {
      let imageBlob: Blob | null = null

      if (videoRef?.current && videoRef.current.readyState >= 2) {
        imageBlob = await captureVideoFrame(videoRef.current)
      }

      if (!imageBlob) {
        fileInputRef.current?.click()
        setIsScanning(false)
        return
      }

      const plantName = plant?.name || 'Unknown Plant'
      const result = await diagnosePlant(imageBlob, plantName)

      if (result) {
        if (!result.isHealthy) {
          setPendingDiagnosis(plantId, result)
        }
        onScanComplete(result)
      } else {
        setScanError('AI could not analyze image. Try again.')
      }
    } catch {
      setScanError('Connection error. Please try again.')
    } finally {
      setIsScanning(false)
    }
  }

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
        setScanError('AI could not analyze image. Try again.')
      }
    } catch {
      setScanError('Connection error. Please try again.')
    } finally {
      setIsScanning(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleItemSelect = (item: ShopItem) => {
    setIsPanelOpen(true)
    if (deleteMode) onDeleteModeChange(false)
    onItemSelected(selectedItemId === item.id ? null : item.id)
  }

  const toggleDeleteMode = () => {
    setIsPanelOpen(true)
    const next = !deleteMode
    onDeleteModeChange(next)
    if (next) onItemSelected(null)
  }

  const selectedItem = selectedItemId ? SHOP_ITEMS.find((item) => item.id === selectedItemId) : null
  const selectedLabel = selectedItem?.name.replace(/\s+/g, ' ').slice(0, 10)
  const readyLabel = arState.detected ? 'READY' : 'FIND'
  const readyActive = arState.detected
  const canUseAnchor = arState.detected

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] px-3 pb-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {!isPanelOpen && (
        <div className="mx-auto flex w-full max-w-md items-center gap-2 rounded-md border border-white/15 bg-black/50 p-2 shadow-xl backdrop-blur-md">
          <StatusPill active={readyActive} label={readyLabel} />
          {selectedLabel && <StatusPill active label={selectedLabel} tone="accent" />}
          <Button
            onClick={() => setIsPanelOpen(true)}
            className="ml-auto h-10 rounded-md bg-primary px-4 font-pixel text-[8px] text-primary-foreground hover:bg-primary/90"
            title="Open AR controls"
          >
            <PanelBottomOpen className="h-4 w-4" />
            Tools
          </Button>
        </div>
      )}

      {isPanelOpen && (
        <div className="mx-auto w-full max-w-2xl rounded-lg border border-white/10 bg-black/58 px-3 pb-3 pt-2 shadow-2xl backdrop-blur-md">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <StatusPill active={readyActive} label={readyLabel} />
              {selectedLabel && (
                <StatusPill active label={selectedLabel} tone="accent" />
              )}
            </div>

            <div className="flex items-center gap-1">
              <IconButton
                label="Hide AR controls"
                onClick={() => setIsPanelOpen(false)}
              >
                <EyeOff className="h-4 w-4" />
              </IconButton>
            </div>
          </div>

          <div className="mb-2 min-w-0 overflow-hidden rounded-sm border border-white/15 bg-black/25 p-1">
            {ownedShopItems.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {ownedShopItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleItemSelect(item)}
                    className={cn(
                      'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-sm border-2 bg-white/10 transition-all',
                      selectedItemId === item.id
                        ? 'scale-105 border-accent bg-accent/25'
                        : 'border-white/25 hover:border-white/60',
                      deleteMode && 'pointer-events-none opacity-35'
                    )}
                    title={item.name}
                  >
                    <ItemThumb item={item} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex h-12 items-center justify-center px-3 text-center font-pixel text-[8px] text-white/70">
                Buy items from Shop to decorate.
              </div>
            )}
          </div>

          <div className="mb-2 grid grid-cols-[44px_1fr_1fr_1fr] gap-2">
            <IconButton
              label="Delete placed items"
              active={deleteMode}
              danger={deleteMode}
              disabled={!canUseAnchor}
              onClick={toggleDeleteMode}
              className="h-10 w-full"
            >
              <Trash2 className="h-4 w-4" />
            </IconButton>

            <Button
              onClick={onPlaceSelected}
              disabled={!selectedItemId || deleteMode || !canUseAnchor}
              variant="outline"
              className="h-10 rounded-sm border-white/25 bg-white/10 font-pixel text-[8px] text-white hover:bg-white/20 disabled:opacity-40"
              title="Place selected item in its preset plant slot"
            >
              <Sparkles className="h-4 w-4" />
              Place
            </Button>

            <Button
              onClick={handleScan}
              disabled={isScanning}
              className="h-10 rounded-sm bg-primary font-pixel text-[8px] text-primary-foreground hover:bg-primary/90 disabled:opacity-70"
              title="Scan plant health"
            >
              {isScanning ? <Spinner className="h-4 w-4" /> : <ScanLine className="h-4 w-4" />}
              Scan
            </Button>

            <Button
              onClick={onCapturePlantPhoto}
              disabled={!onCapturePlantPhoto || isPlantPhotoSaving}
              variant="outline"
              className="h-10 rounded-sm border-white/25 bg-white/10 font-pixel text-[8px] text-white hover:bg-white/20 disabled:opacity-40"
              title="Update this plant photo from the AR camera"
            >
              {isPlantPhotoSaving ? <Spinner className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
              Photo
            </Button>
          </div>

          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isScanning}
            variant="outline"
            className="h-9 w-full rounded-sm border-white/20 bg-black/25 font-pixel text-[8px] text-white hover:bg-white/10 disabled:opacity-70"
          >
            <ImageUp className="h-4 w-4" />
            Upload Photo
          </Button>

          {scanError && (
            <p className="mt-2 text-center font-pixel text-[8px] text-red-300">
              {scanError}
            </p>
          )}
          {plantPhotoStatus && (
            <p className="mt-2 text-center font-pixel text-[8px] text-emerald-200">
              {plantPhotoStatus}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function IconButton({
  label,
  active,
  danger,
  className,
  disabled,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  danger?: boolean
  className?: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-sm border transition-all disabled:pointer-events-none disabled:opacity-35',
        active
          ? danger
            ? 'border-red-400 bg-red-500/35 text-red-50'
            : 'border-accent bg-accent/25 text-accent'
          : 'border-white/20 bg-white/10 text-white hover:border-white/45 hover:bg-white/15',
        className
      )}
    >
      {children}
    </button>
  )
}

function StatusPill({ label, active, tone = 'primary' }: { label: string; active?: boolean; tone?: 'primary' | 'accent' }) {
  return (
    <span
      className={cn(
        'rounded-sm border px-2 py-1 font-pixel text-[7px]',
        active
          ? tone === 'accent'
            ? 'border-accent/70 bg-accent/20 text-accent'
            : 'border-emerald-300/70 bg-emerald-400/15 text-emerald-100'
          : 'border-white/20 bg-white/10 text-white/60'
      )}
    >
      {label}
    </span>
  )
}

function ItemThumb({ item }: { item: ShopItem }) {
  if (item.id === 'hat-crown') return <CrownThumb />
  if (item.category === 'hat') return <HatThumb />
  if (item.id === 'glasses-heart') return <HeartGlassesThumb />
  if (item.category === 'glasses') return <GlassesThumb />
  if (item.id === 'block-diamond') return <DiamondThumb />
  if (item.id === 'vfx-victory-aurora' || item.id === 'vfx-trophy-glow') return <VictoryAuroraThumb />
  if (item.id === 'vfx-rainbow') return <RainbowThumb />
  if (item.category === 'vfx') return <SparkleThumb />
  return <DirtThumb />
}

function HatThumb() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="5" y="18" width="22" height="5" fill="#B88422" />
      <rect x="8" y="12" width="16" height="8" fill="#E8C547" />
      <rect x="9" y="16" width="14" height="3" fill="#5C8A3C" />
    </svg>
  )
}

function CrownThumb() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="7" y="17" width="18" height="7" fill="#C79218" />
      <rect x="8" y="10" width="5" height="9" fill="#F7D14A" />
      <rect x="14" y="7" width="5" height="12" fill="#F7D14A" />
      <rect x="20" y="10" width="5" height="9" fill="#F7D14A" />
      <rect x="10" y="19" width="3" height="3" fill="#69D2E7" />
      <rect x="15" y="19" width="3" height="3" fill="#E84A5F" />
      <rect x="20" y="19" width="3" height="3" fill="#69D2E7" />
    </svg>
  )
}

function GlassesThumb() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="4" y="12" width="10" height="8" fill="#111827" />
      <rect x="18" y="12" width="10" height="8" fill="#111827" />
      <rect x="14" y="15" width="4" height="2" fill="#111827" />
      <rect x="6" y="14" width="5" height="2" fill="#4DD0E1" />
      <rect x="20" y="14" width="5" height="2" fill="#4DD0E1" />
    </svg>
  )
}

function HeartGlassesThumb() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M5 12h4v-3h5v3h3v5h-3v3h-3v3H8v-3H5z" fill="#E84A5F" />
      <path d="M17 12h3v-3h5v3h4v8h-3v3h-3v-3h-3v-3h-3z" fill="#E84A5F" />
      <rect x="14" y="15" width="4" height="2" fill="#7A2633" />
    </svg>
  )
}

function DirtThumb() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="8" y="8" width="16" height="16" fill="#8B5A2B" />
      <rect x="8" y="8" width="16" height="6" fill="#5C8A3C" />
      <rect x="11" y="16" width="4" height="3" fill="#6B4226" />
      <rect x="17" y="18" width="5" height="3" fill="#A06A36" />
    </svg>
  )
}

function DiamondThumb() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="8" y="8" width="16" height="16" fill="#38BDF8" />
      <rect x="10" y="10" width="12" height="5" fill="#A5F3FC" />
      <rect x="11" y="17" width="5" height="5" fill="#67E8F9" />
      <rect x="17" y="17" width="5" height="5" fill="#0891B2" />
    </svg>
  )
}

function SparkleThumb() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="14" y="5" width="4" height="22" fill="#F9E66B" />
      <rect x="5" y="14" width="22" height="4" fill="#F9E66B" />
      <rect x="13" y="13" width="6" height="6" fill="#FFFFFF" />
    </svg>
  )
}

function RainbowThumb() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M6 20a10 10 0 0 1 20 0" fill="none" stroke="#E84A5F" strokeWidth="3" />
      <path d="M9 20a7 7 0 0 1 14 0" fill="none" stroke="#F9E66B" strokeWidth="3" />
      <path d="M12 20a4 4 0 0 1 8 0" fill="none" stroke="#4DD0E1" strokeWidth="3" />
    </svg>
  )
}

function VictoryAuroraThumb() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="7" y="9" width="4" height="4" fill="#35E982" />
      <rect x="11" y="7" width="4" height="4" fill="#F6C35B" />
      <rect x="15" y="9" width="4" height="4" fill="#A5F3FC" />
      <rect x="19" y="13" width="4" height="4" fill="#35E982" />
      <rect x="15" y="17" width="4" height="4" fill="#F6C35B" />
      <rect x="11" y="19" width="4" height="4" fill="#A5F3FC" />
      <rect x="7" y="17" width="4" height="4" fill="#F6C35B" />
      <rect x="5" y="5" width="3" height="3" fill="#FFFFFF" />
      <rect x="24" y="6" width="3" height="3" fill="#FFFFFF" />
      <rect x="25" y="22" width="2" height="2" fill="#F6C35B" />
    </svg>
  )
}
