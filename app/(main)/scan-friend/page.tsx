'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { subscribeToPlant, type PublicPlantData, type QRPayload } from '@/lib/firebase/plant-sync'
import { useGameStore } from '@/lib/store'
import { FriendPlantCard } from '@/components/friend-plant-card'

type ScanState = 'idle' | 'scanning' | 'detected' | 'error'

export default function ScanFriendPage() {
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [plantData, setPlantData] = useState<PublicPlantData | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [detectedPayload, setDetectedPayload] = useState<QRPayload | null>(null)
  const [isProcessingUpload, setIsProcessingUpload] = useState(false)

  const scanVideoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { friendPlants, addFriendPlant } = useGameStore()

  // ─── Camera helpers ────────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      setScanState('scanning')
      startQRScanning()
    } catch {
      setErrorMsg('Unable to open camera. Please grant camera permissions.')
      setScanState('error')
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
  }, [])

  // Attach stream to video element when scanning starts
  useEffect(() => {
    if (scanState === 'scanning' && scanVideoRef.current && streamRef.current) {
      scanVideoRef.current.srcObject = streamRef.current
    }
  }, [scanState])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera()
      unsubscribeRef.current?.()
    }
  }, [stopCamera])

  // ─── Process detected QR payload ──────────────────────────────────────────

  const processPayload = useCallback(async (payload: QRPayload) => {
    setDetectedPayload(payload)

    const unsub = await subscribeToPlant(payload.ownerUid, payload.plantId, (data) => {
      if (data) {
        setPlantData(data)
        setScanState('detected')
        // Save to Friend's Garden
        addFriendPlant(payload.ownerUid, payload.plantId, {
          name: data.name,
          hp: data.hp,
          placedItems: data.placedItems ?? [],
          lastUpdated: data.lastUpdated,
        })
      } else {
        setErrorMsg("Plant owner hasn't enabled public sharing. Ask them to turn on Public Mode!")
        setScanState('error')
      }
    })

    if (unsub) {
      unsubscribeRef.current = unsub
    } else {
      // Firebase not configured — demo data
      const demoData = { name: 'Demo Plant', hp: 75, placedItems: [] as PublicPlantData['placedItems'], lastUpdated: Date.now() }
      setPlantData(demoData)
      setScanState('detected')
      addFriendPlant(payload.ownerUid, payload.plantId, demoData)
    }
  }, [addFriendPlant])

  // ─── QR Scanning via camera ───────────────────────────────────────────────

  const startQRScanning = () => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    scanIntervalRef.current = setInterval(async () => {
      const video = scanVideoRef.current
      if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) return

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

      try {
        let jsQR: ((data: Uint8ClampedArray, w: number, h: number, opts?: { inversionAttempts?: string }) => { data: string } | null) | null = null
        try {
          jsQR = (await import('jsqr' as string) as { default: typeof jsQR }).default
        } catch { return }
        if (!jsQR) return

        const qrResult = jsQR(imageData.data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' })
        if (!qrResult) return

        const payload = JSON.parse(qrResult.data) as QRPayload
        if (payload.app !== 'plantcraft' || !payload.plantId) return

        // Stop scan loop but keep camera alive
        if (scanIntervalRef.current) {
          clearInterval(scanIntervalRef.current)
          scanIntervalRef.current = null
        }

        await processPayload(payload)
      } catch {
        // Not a PlantCraft QR — continue scanning
      }
    }, 300)
  }

  // ─── QR from image upload ─────────────────────────────────────────────────

  const handleUploadQR = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setIsProcessingUpload(true)
    setErrorMsg(null)

    try {
      const bitmap = await createImageBitmap(file)
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(bitmap, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

      let jsQR: ((data: Uint8ClampedArray, w: number, h: number, opts?: { inversionAttempts?: string }) => { data: string } | null) | null = null
      try {
        jsQR = (await import('jsqr' as string) as { default: typeof jsQR }).default
      } catch {
        setErrorMsg('QR scanning library not available.')
        setIsProcessingUpload(false)
        return
      }

      const qrResult = jsQR!(imageData.data, canvas.width, canvas.height, { inversionAttempts: 'attemptBoth' })
      if (!qrResult) {
        setErrorMsg('No QR code found in the image. Try a clearer photo.')
        setScanState('error')
        setIsProcessingUpload(false)
        return
      }

      let payload: QRPayload
      try {
        payload = JSON.parse(qrResult.data) as QRPayload
        if (payload.app !== 'plantcraft' || !payload.plantId) throw new Error()
      } catch {
        setErrorMsg('This QR code is not from PlantCraft.')
        setScanState('error')
        setIsProcessingUpload(false)
        return
      }

      await processPayload(payload)
    } catch {
      setErrorMsg('Failed to read the image. Please try again.')
      setScanState('error')
    } finally {
      setIsProcessingUpload(false)
    }
  }, [processPayload])

  // ─── Actions ──────────────────────────────────────────────────────────────

  const resetScan = () => {
    setScanState('idle')
    setPlantData(null)
    setDetectedPayload(null)
    setErrorMsg(null)
    stopCamera()
    unsubscribeRef.current?.()
    unsubscribeRef.current = null
  }

  const getHpColor = (hp: number) => {
    if (hp >= 70) return '#4CAF50'
    if (hp >= 40) return '#FFC107'
    return '#F44336'
  }

  const getStatusIcon = (hp: number) => {
    if (hp >= 70) return '✅'
    if (hp >= 40) return '⚠️'
    return '🚨'
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full px-4 py-4">
      {/* Header */}
      <div className="mb-4">
        <h2 className="font-pixel text-xs text-foreground">Scan Friend&apos;s Plant</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Scan a QR code to add friend&apos;s plant to your collection!
        </p>
      </div>

      {/* Scanner Area */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-sm border-2 border-primary bg-muted">
        <video
          ref={scanVideoRef}
          autoPlay
          playsInline
          muted
          className={`h-full w-full object-cover ${scanState === 'scanning' ? 'block' : 'hidden'}`}
        />

        {scanState === 'scanning' ? (
          <>
            {/* Corner markers */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative h-40 w-40">
                <div className="absolute left-0 top-0 h-6 w-6 border-l-4 border-t-4 border-accent" />
                <div className="absolute right-0 top-0 h-6 w-6 border-r-4 border-t-4 border-accent" />
                <div className="absolute bottom-0 left-0 h-6 w-6 border-b-4 border-l-4 border-accent" />
                <div className="absolute bottom-0 right-0 h-6 w-6 border-b-4 border-r-4 border-accent" />
                <div className="absolute left-2 right-2 h-0.5 bg-accent/80 ar-scanning-line" />
              </div>
            </div>
            <div className="absolute bottom-3 left-0 right-0 text-center">
              <span className="rounded-sm bg-black/60 px-3 py-1.5 font-pixel text-[8px] text-white">
                📷 Searching for PlantCraft QR...
              </span>
            </div>
          </>
        ) : scanState === 'detected' && plantData ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center bg-gradient-to-b from-primary/5 to-primary/20">
            <div className="w-full max-w-xs rounded-sm border-2 border-primary bg-card p-3 shadow-lg">
              <div className="mb-1 text-2xl">{getStatusIcon(plantData.hp)}</div>
              <h3 className="font-pixel text-xs text-primary">🌿 {plantData.name}</h3>

              <div className="mt-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-pixel text-[7px] text-muted-foreground">HP</span>
                  <span className="font-pixel text-[10px] font-bold" style={{ color: getHpColor(plantData.hp) }}>
                    ♥ {plantData.hp}/100
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${plantData.hp}%`, background: getHpColor(plantData.hp) }}
                  />
                </div>
              </div>

              <p className="mt-2 font-pixel text-[8px] text-primary">✅ Added to Friend&apos;s Garden!</p>
            </div>
          </div>
        ) : scanState === 'error' ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center">
            <span className="text-4xl">❌</span>
            <p className="mt-3 font-pixel text-[10px] text-foreground">{errorMsg || 'An error occurred'}</p>
          </div>
        ) : isProcessingUpload ? (
          <div className="flex h-full flex-col items-center justify-center text-center gap-2">
            <span className="text-4xl animate-spin">⚙️</span>
            <p className="font-pixel text-[10px] text-muted-foreground">Reading QR code...</p>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center gap-2">
            <span className="text-4xl">📸</span>
            <p className="font-pixel text-[10px] text-muted-foreground">
              Scan via camera or upload a QR image
            </p>
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUploadQR}
      />

      {/* Action Buttons */}
      <div className="mt-3 space-y-2">
        {(scanState === 'idle' || isProcessingUpload) && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={startCamera}
              disabled={isProcessingUpload}
              className="rounded-sm bg-primary font-pixel text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              📷 Camera
            </Button>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingUpload}
              variant="outline"
              className="rounded-sm border-2 border-primary font-pixel text-xs disabled:opacity-50"
            >
              {isProcessingUpload ? '⏳ Reading...' : '📁 Upload QR'}
            </Button>
          </div>
        )}

        {scanState === 'scanning' && (
          <Button
            variant="outline"
            onClick={() => { stopCamera(); setScanState('idle') }}
            className="w-full rounded-sm border-2 border-primary font-pixel text-xs"
          >
            ✕ Cancel
          </Button>
        )}

        {scanState === 'detected' && plantData && detectedPayload && (
          <div className="grid grid-cols-2 gap-2">
            <a
              href={`/camera?friendOwner=${detectedPayload.ownerUid}&friendPlant=${detectedPayload.plantId}`}
              className="flex items-center justify-center rounded-sm bg-accent px-3 py-2 font-pixel text-xs text-accent-foreground transition-colors hover:bg-accent/90"
            >
              🔮 View in AR
            </a>
            <Button
              onClick={resetScan}
              variant="outline"
              className="rounded-sm border-2 border-primary font-pixel text-xs"
            >
              🔄 Scan another
            </Button>
          </div>
        )}

        {scanState === 'error' && (
          <Button
            onClick={resetScan}
            className="w-full rounded-sm bg-primary font-pixel text-xs text-primary-foreground hover:bg-primary/90"
          >
            🔄 Try again
          </Button>
        )}
      </div>

      {/* ─── Friend's Garden ──────────────────────────────────────────────────── */}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-pixel text-xs text-foreground">Friend&apos;s Garden</h2>
          <span className="font-pixel text-[8px] text-muted-foreground">
            {friendPlants.length} plant{friendPlants.length !== 1 ? 's' : ''}
          </span>
        </div>

        {friendPlants.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-sm border-2 border-dashed border-border px-4 py-8 text-center">
            <span className="text-3xl">👋</span>
            <p className="mt-2 font-pixel text-[10px] text-muted-foreground">
              No friend plants yet
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Scan a PlantCraft QR code to add plants here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {friendPlants.map((friend) => (
              <FriendPlantCard key={friend.id} friend={friend} />
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-6 rounded-sm border border-border bg-secondary/50 p-4">
        <h3 className="font-pixel text-[10px] text-foreground">How to use:</h3>
        <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
          <li className="flex gap-2"><span className="text-accent">1.</span> Ask friend to open their plant&apos;s QR page</li>
          <li className="flex gap-2"><span className="text-accent">2.</span> Scan QR with camera or upload an image</li>
          <li className="flex gap-2"><span className="text-accent">3.</span> Plant is saved to your Friend&apos;s Garden</li>
          <li className="flex gap-2"><span className="text-accent">4.</span> Tap <span className="font-pixel text-[8px] text-accent">🔮 View in AR</span> to see their decorations live!</li>
        </ul>
      </div>
    </div>
  )
}
