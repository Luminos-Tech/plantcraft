'use client'

import { useEffect, useRef, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useGameStore, DiagnosisResult, SHOP_ITEMS } from '@/lib/store'
import { ARPlantHUD } from '@/components/ar-plant-hud'
import { ARToolbar } from '@/components/ar-toolbar'
import { ScanResultModal } from '@/components/scan-result-modal'

// Placed item for AR visualization
interface PlacedARItem {
  id: string
  itemId: string
  x: number
  y: number
  scale: number
  rotation: number
}

function CameraContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const plantId = searchParams.get('plantId')
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [showHint, setShowHint] = useState(true)
  const [scanResult, setScanResult] = useState<DiagnosisResult | null>(null)
  const [placedItems, setPlacedItems] = useState<PlacedARItem[]>([])
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  
  const { plants, addCareLog, waterPlant, wipePlant } = useGameStore()
  const plant = plants.find((p) => p.id === plantId)

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setIsReady(true)
      }
    } catch (error) {
      console.error('Failed to access camera:', error)
    }
  }, [])

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  // Initialize camera on mount
  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [startCamera, stopCamera])

  // Hide hint after 4 seconds
  useEffect(() => {
    if (showHint) {
      const timer = setTimeout(() => setShowHint(false), 4000)
      return () => clearTimeout(timer)
    }
  }, [showHint])

  // Handle close
  const handleClose = () => {
    stopCamera()
    router.push('/dashboard')
  }

  // Handle scan result
  const handleScanComplete = (result: DiagnosisResult) => {
    setScanResult(result)
    if (plantId) {
      addCareLog(plantId, 'scan', result.disease)
    }
  }

  // Handle tap to place item on camera view
  const handlePlaceItem = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedItemId) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    const newItem: PlacedARItem = {
      id: crypto.randomUUID(),
      itemId: selectedItemId,
      x,
      y,
      scale: 1,
      rotation: Math.random() * 20 - 10, // slight random rotation
    }

    setPlacedItems((prev) => [...prev, newItem])
    setSelectedItemId(null)
  }

  // Get item visual appearance
  const getItemVisual = (itemId: string) => {
    const item = SHOP_ITEMS.find((i) => i.id === itemId)
    if (!item) return { color: '#5C8A3C', shape: 'block', emoji: '📦' }

    switch (item.category) {
      case 'hat': return { color: '#E8C547', shape: 'hat', emoji: '🎩' }
      case 'glasses': return { color: '#5C8A3C', shape: 'glasses', emoji: '👓' }
      case 'block': return { color: '#8B7355', shape: 'block', emoji: '🟫' }
      case 'vfx': return { color: '#A855F7', shape: 'vfx', emoji: '✨' }
      default: return { color: '#5C8A3C', shape: 'block', emoji: '📦' }
    }
  }

  // If no plant selected, show selector
  if (!plant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <span className="text-4xl">🌿</span>
        <h2 className="mt-4 font-pixel text-sm text-foreground">
          Select a plant
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Go to garden and click &quot;AR Decor&quot; on the plant card.
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-6 rounded-sm bg-primary px-6 py-2 font-pixel text-xs text-primary-foreground"
        >
          Back to Garden
        </button>
      </div>
    )
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      {/* Camera Feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="h-full w-full object-cover"
      />

      {/* AR Overlay Container — tap to place items */}
      <div
        id="ar-overlay"
        className="absolute inset-0"
        onClick={handlePlaceItem}
      >
        {/* HUD Top */}
        <div className="pointer-events-auto relative z-10">
          <ARPlantHUD plant={plant} onClose={handleClose} />
        </div>

        {/* Quick Care Actions */}
        <div className="absolute right-3 top-24 z-10 flex flex-col gap-2 pointer-events-auto">
          <button
            onClick={(e) => { e.stopPropagation(); waterPlant(plant.id) }}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/80 text-lg shadow-lg active:scale-95 transition-transform"
            title="Water"
          >
            💧
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); wipePlant(plant.id) }}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/80 text-lg shadow-lg active:scale-95 transition-transform"
            title="Wipe leaves"
          >
            🍃
          </button>
        </div>

        {/* Pending Disease Warning */}
        {plant.pendingDiagnosis && (
          <div className="absolute left-3 top-24 z-10 pointer-events-auto">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setScanResult(plant.pendingDiagnosis!)
              }}
              className="rounded-sm bg-red-500/90 px-3 py-2 font-pixel text-[8px] text-white shadow-lg animate-pulse"
            >
              🚨 {plant.pendingDiagnosis.disease}
              <br />
              <span className="text-[6px] opacity-80">Click for details</span>
            </button>
          </div>
        )}

        {/* Hint Overlay */}
        {showHint && isReady && (
          <div className="absolute inset-0 z-[5] flex items-center justify-center pointer-events-none">
            <div
              className="rounded-sm bg-black/50 px-6 py-4 text-center animate-pulse"
              style={{ backdropFilter: 'blur(4px)' }}
            >
              <span className="font-pixel text-xs text-white">
                👆 Tap on plant to place items
              </span>
            </div>
          </div>
        )}

        {/* Placed Items Visualization */}
        {placedItems.map((item) => {
          const visual = getItemVisual(item.itemId)
          return (
            <div
              key={item.id}
              className="absolute pointer-events-none"
              style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                transform: `translate(-50%, -50%) rotate(${item.rotation}deg) scale(${item.scale})`,
              }}
            >
              {/* 3D-ish voxel block representation */}
              <div
                className="relative h-12 w-12 flex items-center justify-center animate-bounce"
                style={{ animationDuration: '2s' }}
              >
                {/* Shadow */}
                <div
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 h-2 w-10 rounded-full opacity-30"
                  style={{ background: 'black', filter: 'blur(3px)' }}
                />
                {/* Item body */}
                <div
                  className="relative flex h-10 w-10 items-center justify-center rounded-sm border-2 shadow-lg"
                  style={{
                    borderColor: visual.color,
                    background: `${visual.color}33`,
                    boxShadow: `0 0 12px ${visual.color}66`,
                  }}
                >
                  <span className="text-xl">{visual.emoji}</span>
                </div>
              </div>
            </div>
          )
        })}

        {/* Currently equipped items from store */}
        {plant.equippedItems.length > 0 && isReady && placedItems.length === 0 && (
          <div className="absolute left-1/2 top-1/3 -translate-x-1/2 pointer-events-none">
            <div className="flex flex-wrap justify-center gap-2">
              {plant.equippedItems.slice(0, 6).map((itemId, idx) => {
                const visual = getItemVisual(itemId)
                return (
                  <div
                    key={`${itemId}-${idx}`}
                    className="flex h-10 w-10 items-center justify-center rounded-sm border-2 animate-bounce shadow-lg"
                    style={{
                      animationDelay: `${idx * 0.3}s`,
                      animationDuration: '2s',
                      borderColor: visual.color,
                      background: `${visual.color}33`,
                      boxShadow: `0 0 12px ${visual.color}44`,
                    }}
                  >
                    <span className="text-lg">{visual.emoji}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* HUD Bottom */}
        <div className="pointer-events-auto relative z-10">
          <ARToolbar
            plantId={plant.id}
            onScanComplete={handleScanComplete}
            videoRef={videoRef}
          />
        </div>
      </div>

      {/* Scan Result Modal */}
      <ScanResultModal
        result={scanResult}
        plantId={plant.id}
        open={!!scanResult}
        onOpenChange={(open) => !open && setScanResult(null)}
      />
    </div>
  )
}

export default function CameraPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-center">
          <span className="text-4xl animate-pulse">📷</span>
          <p className="mt-2 font-pixel text-xs text-white">Opening camera...</p>
        </div>
      </div>
    }>
      <CameraContent />
    </Suspense>
  )
}
