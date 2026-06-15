'use client'

import { useEffect, useRef, useState, useCallback, Suspense } from 'react'
import { ArrowLeft, Camera as CameraIcon, Leaf } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useGameStore, DiagnosisResult, PlacedItem, dedupePlacedItemsBySlot, getDecorationPlacement, SHOP_ITEMS } from '@/lib/store'
import { ARPlantHUD } from '@/components/ar-plant-hud'
import { ARToolbar } from '@/components/ar-toolbar'
import { ScanResultModal } from '@/components/scan-result-modal'
import { FilterEngine, type ARFrameState, type BBox } from '@/lib/filter/filter-engine'
import { subscribeToPlant, type PublicPlantData } from '@/lib/firebase/plant-sync'
import { Button } from '@/components/ui/button'

const DEFAULT_AR_STATE: ARFrameState = {
  anchor: null,
  detected: false,
  locked: false,
  source: null,
  label: 'Manual',
}

function getItemCategory(itemId: string) {
  return SHOP_ITEMS.find((item) => item.id === itemId)?.category ?? 'block'
}

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
  const friendDataRef = useRef<PublicPlantData | null>(null)

  const [isReady, setIsReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [scanResult, setScanResult] = useState<DiagnosisResult | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [friendData, setFriendData] = useState<PublicPlantData | null>(null)
  const [deleteMode, setDeleteMode] = useState(false)
  const [arState, setArState] = useState<ARFrameState>(DEFAULT_AR_STATE)

  const { plants, friendPlants, savePlacedItem, removePlacedItem, addCareLog, updateFriendPlant } = useGameStore()
  const plant = plants.find((p) => p.id === plantId)
  const selectedItem = selectedItemId ? SHOP_ITEMS.find((item) => item.id === selectedItemId) : null

  useEffect(() => {
    friendDataRef.current = friendData
  }, [friendData])

  useEffect(() => {
    if (!isFriendMode) return

    const local = friendPlants.find(
      (f) => f.ownerUid === friendOwner && f.plantId === friendPlantId
    )
    if (local) {
      setFriendData({
        name: local.name,
        description: local.description,
        hp: local.hp,
        placedItems: local.placedItems,
        lastUpdated: local.lastUpdated,
      })
    }

    let unsub: (() => void) | null = null
    subscribeToPlant(friendOwner!, friendPlantId!, (data) => {
      if (!data) return
      setFriendData(data)
      const current = useGameStore.getState().friendPlants.find(
        (friend) => friend.ownerUid === friendOwner && friend.plantId === friendPlantId
      )
      if (current) {
        updateFriendPlant(current.id, {
          name: data.name,
          description: data.description,
          hp: data.hp,
          placedItems: data.placedItems ?? [],
          lastUpdated: data.lastUpdated,
        })
      }
    }).then((u) => { unsub = u })

    return () => { unsub?.() }
  }, [isFriendMode, friendOwner, friendPlantId, friendPlants, updateFriendPlant])

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return
    if (!plantId && !isFriendMode) return

    let cancelled = false
    const engine = new FilterEngine(videoRef.current, canvasRef.current)
    engineRef.current = engine
    setIsReady(false)
    setCameraError(null)
    setArState(DEFAULT_AR_STATE)

    const initEngine = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera API is unavailable in this browser.')
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 960 },
            height: { ideal: 540 },
            frameRate: { ideal: 24, max: 30 },
          },
          audio: false,
        })

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        await engine.loadModel()
        if (cancelled) return

        const getItems = () => {
          if (isFriendMode) {
            return (friendDataRef.current?.placedItems ?? []).map((item) => ({
              ...item,
              plantId: friendPlantId!,
              isShared: true,
              placedAt: 0,
            } as PlacedItem))
          }

          return useGameStore.getState().plants.find((p) => p.id === plantId)?.placedItems ?? []
        }

        engine.start(
          getItems,
          getItemCategory,
          (state) => setArState(state)
        )
        setIsReady(true)
      } catch (err) {
        console.error('Camera init failed', err)
        if (!cancelled) {
          setCameraError('Camera unavailable. Check permission and try again.')
          setIsReady(true)
        }
      }
    }

    initEngine()

    return () => {
      cancelled = true
      engine.stop()
      if (engineRef.current === engine) engineRef.current = null
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach((track) => track.stop())
        videoRef.current.srcObject = null
      }
    }
  }, [plantId, isFriendMode, friendPlantId])

  const ensureDetectedAnchor = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return null
    const state = engine.getState()
    if (!state.anchor || !state.detected) return null
    setArState(state)
    return state
  }, [])

  const saveDecoration = useCallback((itemId: string) => {
    if (!plantId) return

    const placement = getDecorationPlacement(itemId)
    const newItem: PlacedItem = {
      id: crypto.randomUUID(),
      itemId,
      plantId,
      placementSlot: placement.placementSlot,
      scaleRatio: placement.scaleRatio,
      isShared: plant?.isPublic ?? false,
      placedAt: Date.now(),
    }

    savePlacedItem(plantId, newItem)
    addCareLog(plantId, 'decorate', `Placed ${SHOP_ITEMS.find((item) => item.id === itemId)?.name ?? 'item'}`)
  }, [addCareLog, plant?.isPublic, plantId, savePlacedItem])

  const handlePlaceSelected = useCallback(() => {
    if (!selectedItemId) return
    const detectedState = ensureDetectedAnchor()
    if (!detectedState) return

    saveDecoration(selectedItemId)
    setSelectedItemId(null)
  }, [ensureDetectedAnchor, saveDecoration, selectedItemId])

  const handleCanvasTap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isFriendMode) return
    if (!plantId || !engineRef.current) return
    if (!deleteMode) return

    e.preventDefault()
    const detectedState = ensureDetectedAnchor()
    if (!detectedState) return

    const bbox = engineRef.current.getLastBbox()
    if (!bbox || !canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const tapX = e.clientX - rect.left
    const tapY = e.clientY - rect.top

    if (deleteMode) {
      const currentPlant = useGameStore.getState().plants.find((p) => p.id === plantId)
      const items = dedupePlacedItemsBySlot(currentPlant?.placedItems ?? [])
      const closest = findClosestItem(items, bbox, tapX, tapY)

      if (closest) {
        removePlacedItem(plantId, closest.id)
        addCareLog(plantId, 'decorate', 'Removed item')
      }
      return
    }
  }

  const handleScanComplete = (result: DiagnosisResult) => {
    setScanResult(result)
    if (plantId) {
      addCareLog(plantId, 'scan', result.isHealthy ? 'Healthy scan' : result.disease)
    }
  }

  if (!plantId && !isFriendMode) {
    return (
      <div className="flex h-screen flex-col bg-background p-4 pt-12">
        <div className="mb-6 grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/dashboard')}
            className="rounded-md border-primary/40 bg-card/90 font-pixel text-[8px]"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <h1 className="text-center font-pixel text-sm text-foreground sm:text-lg">Select a Plant for AR</h1>
          <span className="h-8 w-[72px]" aria-hidden="true" />
        </div>
        {plants.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center">
            <Leaf className="h-10 w-10 text-muted-foreground" />
            <p className="mt-3 font-pixel text-xs text-muted-foreground">Your garden is empty.</p>
            <Button onClick={() => router.push('/dashboard')} className="mt-4 rounded-md font-pixel text-xs">
              <ArrowLeft className="h-4 w-4" /> Go to Garden
            </Button>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-lg flex-col gap-3">
            {plants.map((p) => (
              <button
                key={p.id}
                className="card-hover flex h-16 items-center gap-3 rounded-lg border-2 border-border bg-card/95 px-4 font-pixel text-xs text-foreground transition-all hover:border-primary"
                onClick={() => router.push(`/camera?plantId=${p.id}`)}
              >
                <Leaf className="h-5 w-5 text-primary" />
                <span className="truncate">{p.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (plantId && !plant && !isFriendMode) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background p-4">
        <Leaf className="h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 font-pixel text-sm text-foreground">Plant not found</h1>
        <Button onClick={() => router.push('/dashboard')} className="mt-6 rounded-md font-pixel text-xs">
          <ArrowLeft className="h-4 w-4" /> Back to Garden
        </Button>
      </div>
    )
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black select-none">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        onPointerUp={handleCanvasTap}
        style={{ touchAction: 'none' }}
      />

      {isReady && !cameraError && (
        <>
          {isFriendMode ? (
            <FriendHUD
              friendData={friendData}
              onClose={() => router.push('/scan-friend')}
            />
          ) : (
            <ARPlantHUD plant={plant!} onClose={() => router.push('/dashboard')} />
          )}

          <ARStatusOverlay
            arState={arState}
            deleteMode={deleteMode}
            selectedItemName={selectedItem?.name ?? null}
            isFriendMode={isFriendMode}
          />

          {!isFriendMode && (
            <ARToolbar
              plantId={plantId!}
              videoRef={videoRef}
              onScanComplete={handleScanComplete}
              selectedItemId={selectedItemId}
              onItemSelected={(itemId) => {
                setSelectedItemId(itemId)
                if (itemId) setDeleteMode(false)
              }}
              deleteMode={deleteMode}
              onDeleteModeChange={(mode) => {
                setDeleteMode(mode)
                if (mode) setSelectedItemId(null)
              }}
              arState={arState}
              onPlaceSelected={handlePlaceSelected}
            />
          )}

          {isFriendMode && (
            <div className="fixed bottom-6 left-0 right-0 z-[9999] px-6">
              <Button
                onClick={() => router.push('/scan-friend')}
                className="w-full rounded-sm bg-primary font-pixel text-xs text-primary-foreground shadow-lg hover:bg-primary/90"
              >
                Back to Friend&apos;s Garden
              </Button>
            </div>
          )}
        </>
      )}

      {!isReady && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-background/80 font-pixel text-xs backdrop-blur-md">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          Starting Stable AR...
        </div>
      )}

      {isReady && cameraError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background p-6 text-center">
          <CameraIcon className="h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 font-pixel text-sm text-foreground">Camera Error</h1>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">{cameraError}</p>
          <Button onClick={() => router.push('/dashboard')} className="mt-6 rounded-md font-pixel text-xs">
            <ArrowLeft className="h-4 w-4" /> Back to Garden
          </Button>
        </div>
      )}

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

function findClosestItem(items: PlacedItem[], bbox: BBox, tapX: number, tapY: number) {
  const [bx, by, bw, bh] = bbox
  let closestItem: PlacedItem | null = null
  let closestDist = Infinity

  for (const item of items) {
    const placement = getDecorationPlacement(item.itemId, item.placementSlot)
    const itemX = bx + bw * placement.anchorX
    const itemY = by + bh * placement.anchorY
    const dist = Math.hypot(tapX - itemX, tapY - itemY)
    const radius = Math.max(34, bw * placement.scaleRatio * 0.48)

    if (dist <= radius && dist < closestDist) {
      closestDist = dist
      closestItem = item
    }
  }

  return closestItem
}

function FriendHUD({ friendData, onClose }: { friendData: PublicPlantData | null; onClose: () => void }) {
  const hp = friendData?.hp ?? 0
  const hpColor = hp >= 70 ? '#4CAF50' : hp >= 40 ? '#FFC107' : '#F44336'

  return (
    <div className="fixed left-0 right-0 top-0 z-[9999] bg-black/35 p-3 backdrop-blur-sm" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md text-white hover:bg-white/20">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex flex-1 items-center justify-center gap-1.5 font-pixel text-[10px] text-white">
          <Leaf className="h-3.5 w-3.5" />
          {friendData?.name || 'Friend Plant'}
        </div>
        <div className="font-pixel text-[8px] font-bold" style={{ color: hpColor }}>
          ♥ {hp}
        </div>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/20">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${hp}%`, background: hpColor }}
        />
      </div>
    </div>
  )
}

function ARStatusOverlay({
  arState,
  deleteMode,
  selectedItemName,
  isFriendMode,
}: {
  arState: ARFrameState
  deleteMode: boolean
  selectedItemName: string | null
  isFriendMode: boolean
}) {
  const isReady = arState.detected
  const statusText = arState.detected
      ? 'Plant found'
      : 'Find plant'
  const actionText = isFriendMode
    ? 'Shared view'
    : deleteMode
      ? 'Tap item to remove'
      : selectedItemName
        ? `Place preset for ${selectedItemName}`
        : 'Find plant, then choose decor'

  return (
    <div
      className="pointer-events-none fixed left-1/2 top-[100px] z-[9998] w-[min(88vw,360px)] -translate-x-1/2 rounded-md border px-4 py-2.5 text-center shadow-lg backdrop-blur-sm transition-colors"
      style={{
        borderColor: isReady ? 'rgba(53, 233, 130, 0.78)' : 'rgba(255, 255, 255, 0.15)',
        background: isReady ? 'rgba(10, 52, 32, 0.62)' : 'rgba(0, 0, 0, 0.5)',
        boxShadow: isReady ? '0 0 22px rgba(53, 233, 130, 0.24)' : undefined,
      }}
    >
      <div className="font-pixel text-[8px] uppercase tracking-normal" style={{ color: isReady ? '#35E982' : 'rgba(255,255,255,0.7)' }}>
        {statusText}
      </div>
      <div className="mt-1 font-pixel text-[9px] text-white">
        {actionText}
      </div>
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
