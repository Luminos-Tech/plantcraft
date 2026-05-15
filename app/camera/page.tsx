'use client'

import { useEffect, useRef, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useGameStore, DiagnosisResult, PlacedItem, ITEM_DEFAULT_ANCHOR, SHOP_ITEMS } from '@/lib/store'
import { ARPlantHUD } from '@/components/ar-plant-hud'
import { ARToolbar } from '@/components/ar-toolbar'
import { ScanResultModal } from '@/components/scan-result-modal'
import { FilterEngine } from '@/lib/filter/filter-engine'
import { subscribeToPlant, type PublicPlantData } from '@/lib/firebase/plant-sync'
import { Button } from '@/components/ui/button'

function CameraContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const plantId = searchParams.get('plantId')
  const friendOwner = searchParams.get('friendOwner')
  const friendPlantId = searchParams.get('friendPlant')
  const isFriendMode = !!(friendOwner && friendPlantId)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<FilterEngine | null>(null)
  
  const [isReady, setIsReady] = useState(false)
  const [scanResult, setScanResult] = useState<DiagnosisResult | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(true)
  const [friendData, setFriendData] = useState<PublicPlantData | null>(null)
  
  const { plants, friendPlants, savePlacedItem, addCareLog } = useGameStore()
  const plant = plants.find((p) => p.id === plantId)

  // Fetch friend data if in friend mode
  useEffect(() => {
    if (!isFriendMode) return

    // Try local store first
    const local = friendPlants.find(
      (f) => f.ownerUid === friendOwner && f.plantId === friendPlantId
    )
    if (local) {
      setFriendData({
        name: local.name,
        hp: local.hp,
        placedItems: local.placedItems,
        lastUpdated: local.lastUpdated,
      })
    }

    // Subscribe to Firebase for live updates
    let unsub: (() => void) | null = null
    subscribeToPlant(friendOwner!, friendPlantId!, (data) => {
      if (data) setFriendData(data)
    }).then((u) => { unsub = u })

    return () => { unsub?.() }
  }, [isFriendMode, friendOwner, friendPlantId, friendPlants])

  // Initialize camera and FilterEngine
  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return
    if (!plantId && !isFriendMode) return

    const engine = new FilterEngine(videoRef.current, canvasRef.current)
    engineRef.current = engine

    const initEngine = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
        
        await engine.loadModel()
        setIsReady(true)

        // Helper to get item category
        const getCategory = (itemId: string) => {
          const item = SHOP_ITEMS.find((i) => i.id === itemId)
          return item ? item.category : 'block'
        }

        // Wait to make sure we have data, especially in friend mode
        const getItems = () => {
          if (isFriendMode) {
            // Convert SharedPlacedItem to PlacedItem internally for rendering
            return (friendData?.placedItems || []).map(i => ({
              ...i,
              plantId: friendPlantId!,
              isShared: true,
              placedAt: 0,
            } as PlacedItem))
          } else {
            return useGameStore.getState().plants.find(p => p.id === plantId)?.placedItems || []
          }
        }

        engine.start(getItems, getCategory, (detected) => setShowHint(!detected))
      } catch (err) {
        console.error('Camera init failed', err)
      }
    }

    initEngine()

    return () => {
      engine.stop()
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach(t => t.stop())
      }
    }
  }, [plantId, isFriendMode, friendData?.placedItems])

  // Handle tap on canvas to place selected item
  const handleCanvasTap = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (isFriendMode) return // Read-only in friend mode
    if (!selectedItemId || !plantId || !engineRef.current) return

    const bbox = engineRef.current.getLastBbox()
    if (!bbox) return

    const rect = canvasRef.current!.getBoundingClientRect()
    let clientX, clientY
    if ('touches' in e) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = (e as React.MouseEvent).clientX
      clientY = (e as React.MouseEvent).clientY
    }

    const tapX = clientX - rect.left
    const tapY = clientY - rect.top
    const [bx, by, bw, bh] = bbox
    const anchorX = (tapX - bx) / bw
    const anchorY = (tapY - by) / bh
    
    const category = SHOP_ITEMS.find(i => i.id === selectedItemId)?.category || 'block'
    const scaleRatio = ITEM_DEFAULT_ANCHOR[category]?.scaleRatio ?? 0.35

    const newItem: PlacedItem = {
      id: crypto.randomUUID(),
      itemId: selectedItemId,
      plantId: plantId,
      anchorX,
      anchorY,
      scaleRatio,
      isShared: plant?.isPublic || false,
      placedAt: Date.now(),
    }

    savePlacedItem(plantId, newItem)
    setSelectedItemId(null) // deselect
  }

  const handleScanComplete = (result: DiagnosisResult) => {
    setScanResult(result)
    if (plantId) {
      addCareLog(plantId, 'scan', result.disease)
    }
  }

  // If accessed directly from bottom nav without plantId, let user select one
  if (!plantId && !isFriendMode) {
    return (
      <div className="flex h-screen flex-col bg-background p-4 pt-12">
        <h1 className="mb-6 text-center font-pixel text-lg text-foreground">Select a Plant for AR</h1>
        {plants.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center">
            <p className="font-pixel text-xs text-muted-foreground">Your garden is empty.</p>
            <Button onClick={() => router.push('/dashboard')} className="mt-4 font-pixel text-xs">
              Go to Garden
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {plants.map(p => (
              <Button 
                key={p.id} 
                variant="outline" 
                className="h-16 justify-start px-4 font-pixel text-xs"
                onClick={() => router.push(`/camera?plantId=${p.id}`)}
              >
                <span className="mr-3 text-2xl">🌱</span>
                {p.name}
              </Button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden select-none">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full object-cover"
        onClick={handleCanvasTap}
        onTouchEnd={handleCanvasTap}
      />

      {isReady && (
        <>
          {/* HUD Top Bar */}
          {isFriendMode ? (
            <div className="fixed top-0 left-0 right-0 z-[9999] bg-black/35 p-3 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <button onClick={() => router.push('/scan-friend')} className="text-white text-lg leading-none">✕</button>
                <div className="flex-1 text-center font-pixel text-[10px] text-white">
                  🌿 {friendData?.name || 'Friend Plant'}
                </div>
                <div className="font-pixel text-[8px] font-bold" style={{ color: (friendData?.hp || 0) >= 70 ? '#4CAF50' : (friendData?.hp || 0) >= 40 ? '#FFC107' : '#F44336' }}>
                  ♥ {friendData?.hp || 0}
                </div>
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-white/20 overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${friendData?.hp || 0}%`,
                    background: (friendData?.hp || 0) >= 70 ? '#4CAF50' : (friendData?.hp || 0) >= 40 ? '#FFC107' : '#F44336' 
                  }}
                />
              </div>
            </div>
          ) : (
            <ARPlantHUD plant={plant!} onClose={() => router.push('/dashboard')} />
          )}

          {/* Educational Hints Overlay */}
          {showHint && !selectedItemId && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse whitespace-nowrap rounded-sm bg-black/50 px-4 py-2 font-pixel text-[10px] text-white backdrop-blur-sm">
              Point camera at your plant
            </div>
          )}
          {showHint && selectedItemId && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse whitespace-nowrap rounded-sm bg-black/50 px-4 py-2 font-pixel text-[10px] text-accent backdrop-blur-sm">
              Waiting for plant detection to place...
            </div>
          )}
          {!showHint && selectedItemId && (
            <div className="pointer-events-none absolute left-1/2 top-1/4 -translate-x-1/2 -translate-y-1/2 animate-bounce whitespace-nowrap rounded-sm bg-accent/80 px-4 py-2 font-pixel text-[10px] text-white shadow-lg">
              Tap anywhere on plant to place!
            </div>
          )}

          {/* Toolbar (Only for owner) */}
          {!isFriendMode && (
            <ARToolbar 
              plantId={plantId!} 
              videoRef={videoRef} 
              onScanComplete={handleScanComplete} 
              selectedItemId={selectedItemId}
              onItemSelected={setSelectedItemId}
            />
          )}

          {/* Friend Mode Back Button (when no toolbar) */}
          {isFriendMode && (
            <div className="fixed bottom-6 left-0 right-0 z-[9999] px-6">
              <Button 
                onClick={() => router.push('/scan-friend')} 
                className="w-full rounded-sm bg-primary font-pixel text-xs text-primary-foreground shadow-lg hover:bg-primary/90"
              >
                ⬅ Back to Friend&apos;s Garden
              </Button>
            </div>
          )}
        </>
      )}

      {/* Loading Overlay */}
      {!isReady && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-background/80 font-pixel text-xs backdrop-blur-md">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
          Starting AR Filter...
        </div>
      )}

      {/* AI Result Modal */}
      {scanResult && plantId && (
        <ScanResultModal
          open={!!scanResult}
          onOpenChange={(isOpen) => { if (!isOpen) setScanResult(null) }}
          result={scanResult}
          plantId={plantId}
        />
      )}
    </div>
  )
}

export default function CameraPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-background font-pixel text-xs">
        Loading...
      </div>
    }>
      <CameraContent />
    </Suspense>
  )
}
