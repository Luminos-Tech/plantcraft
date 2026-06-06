'use client'

import { useEffect, useRef, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useGameStore, DiagnosisResult, PlacedItem, ITEM_DEFAULT_ANCHOR, SHOP_ITEMS } from '@/lib/store'
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

  const { plants, friendPlants, savePlacedItem, removePlacedItem, addCareLog } = useGameStore()
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
        hp: local.hp,
        placedItems: local.placedItems,
        lastUpdated: local.lastUpdated,
      })
    }

    let unsub: (() => void) | null = null
    subscribeToPlant(friendOwner!, friendPlantId!, (data) => {
      if (data) setFriendData(data)
    }).then((u) => { unsub = u })

    return () => { unsub?.() }
  }, [isFriendMode, friendOwner, friendPlantId, friendPlants])

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
          (state) => setArState(state),
          { autoLock: isFriendMode }
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

  const lockAnchor = useCallback(() => {
    const state = engineRef.current?.lockAnchor()
    if (state) setArState(state)
  }, [])

  const unlockAnchor = useCallback(() => {
    const state = engineRef.current?.unlockAnchor()
    if (state) setArState(state)
  }, [])

  const resetAnchor = useCallback(() => {
    const state = engineRef.current?.resetAnchor()
    if (state) setArState(state)
  }, [])

  const scaleAnchor = useCallback((factor: number) => {
    const state = engineRef.current?.scaleLockedAnchor(factor)
    if (state) setArState(state)
  }, [])

  const moveAnchor = useCallback((dxRatio: number, dyRatio: number) => {
    const state = engineRef.current?.moveLockedAnchor(dxRatio, dyRatio)
    if (state) setArState(state)
  }, [])

  const ensureLockedAnchor = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return null
    const state = engine.getState()
    if (state.locked) return state
    const nextState = engine.lockAnchor()
    setArState(nextState)
    return nextState
  }, [])

  const saveDecoration = useCallback((itemId: string, anchorX: number, anchorY: number, scaleRatio?: number) => {
    if (!plantId) return

    const category = getItemCategory(itemId)
    const defaults = ITEM_DEFAULT_ANCHOR[category]
    const newItem: PlacedItem = {
      id: crypto.randomUUID(),
      itemId,
      plantId,
      anchorX,
      anchorY,
      scaleRatio: scaleRatio ?? defaults?.scaleRatio ?? 0.35,
      isShared: plant?.isPublic ?? false,
      placedAt: Date.now(),
    }

    savePlacedItem(plantId, newItem)
    addCareLog(plantId, 'decorate', `Placed ${SHOP_ITEMS.find((item) => item.id === itemId)?.name ?? 'item'}`)
  }, [addCareLog, plant?.isPublic, plantId, savePlacedItem])

  const handleAutoFitSelected = useCallback(() => {
    if (!selectedItemId) return
    ensureLockedAnchor()

    const category = getItemCategory(selectedItemId)
    const defaults = ITEM_DEFAULT_ANCHOR[category] ?? ITEM_DEFAULT_ANCHOR.block
    saveDecoration(selectedItemId, defaults.anchorX, defaults.anchorY, defaults.scaleRatio)
    setSelectedItemId(null)
  }, [ensureLockedAnchor, saveDecoration, selectedItemId])

  const handleCanvasTap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isFriendMode) return
    if (!plantId || !engineRef.current) return
    if (!deleteMode && !selectedItemId) return

    e.preventDefault()
    ensureLockedAnchor()

    const bbox = engineRef.current.getLastBbox()
    if (!bbox || !canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const tapX = e.clientX - rect.left
    const tapY = e.clientY - rect.top
    const [bx, by, bw, bh] = bbox
    const anchorX = (tapX - bx) / bw
    const anchorY = (tapY - by) / bh

    if (deleteMode) {
      const currentPlant = useGameStore.getState().plants.find((p) => p.id === plantId)
      const items = currentPlant?.placedItems ?? []
      const closest = findClosestItem(items, bbox, tapX, tapY)

      if (closest) {
        removePlacedItem(plantId, closest.id)
        addCareLog(plantId, 'decorate', 'Removed item')
      }
      return
    }

    if (!selectedItemId) return
    if (anchorX < -0.25 || anchorX > 1.25 || anchorY < -0.4 || anchorY > 1.25) return

    const category = getItemCategory(selectedItemId)
    const scaleRatio = ITEM_DEFAULT_ANCHOR[category]?.scaleRatio ?? 0.35
    saveDecoration(selectedItemId, anchorX, anchorY, scaleRatio)
    setSelectedItemId(null)
  }

  const handleScanComplete = (result: DiagnosisResult) => {
    setScanResult(result)
    if (plantId) {
      addCareLog(plantId, 'scan', result.disease)
    }
  }

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
            {plants.map((p) => (
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

  if (plantId && !plant && !isFriendMode) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background p-4">
        <span className="text-4xl">❓</span>
        <h1 className="mt-4 font-pixel text-sm text-foreground">Plant not found</h1>
        <Button onClick={() => router.push('/dashboard')} className="mt-6 rounded-sm font-pixel text-xs">
          Back to Garden
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
              onLockAnchor={lockAnchor}
              onUnlockAnchor={unlockAnchor}
              onResetAnchor={resetAnchor}
              onScaleAnchor={scaleAnchor}
              onMoveAnchor={moveAnchor}
              onAutoFitSelected={handleAutoFitSelected}
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
          <span className="text-4xl">📷</span>
          <h1 className="mt-4 font-pixel text-sm text-foreground">Camera Error</h1>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">{cameraError}</p>
          <Button onClick={() => router.push('/dashboard')} className="mt-6 rounded-sm font-pixel text-xs">
            Back to Garden
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
    const itemX = bx + bw * item.anchorX
    const itemY = by + bh * item.anchorY
    const dist = Math.hypot(tapX - itemX, tapY - itemY)
    const radius = Math.max(34, bw * item.scaleRatio * 0.48)

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
    <div className="fixed left-0 right-0 top-0 z-[9999] bg-black/35 p-3 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-sm text-white hover:bg-white/20">
          ×
        </button>
        <div className="flex-1 text-center font-pixel text-[10px] text-white">
          🌿 {friendData?.name || 'Friend Plant'}
        </div>
        <div className="font-pixel text-[8px] font-bold" style={{ color: hpColor }}>
          ♥ {hp}
        </div>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
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
  const statusText = arState.locked
    ? 'Anchor locked'
    : arState.detected
      ? 'Plant found'
      : 'Align frame'
  const actionText = isFriendMode
    ? 'Shared view'
    : deleteMode
      ? 'Tap item to remove'
      : selectedItemName
        ? `Tap plant or Fit ${selectedItemName}`
        : 'Lock frame, then decorate'

  return (
    <div className="pointer-events-none fixed left-1/2 top-[112px] z-[9998] w-[min(88vw,360px)] -translate-x-1/2 rounded-sm border border-white/15 bg-black/45 px-3 py-2 text-center shadow-lg backdrop-blur-sm">
      <div className="font-pixel text-[8px] uppercase tracking-normal text-white/70">
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
