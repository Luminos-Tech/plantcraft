'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { subscribeToPlant, type PublicPlantData, type QRPayload } from '@/lib/firebase/plant-sync'

type ScanState = 'idle' | 'scanning' | 'detected' | 'error'

export default function ScanFriendPage() {
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [plantData, setPlantData] = useState<PublicPlantData | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [detectedPayload, setDetectedPayload] = useState<QRPayload | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setScanState('scanning')
      startQRScanning()
    } catch (error) {
      console.error('Failed to access camera:', error)
      setErrorMsg('Unable to open camera. Please grant camera permissions.')
      setScanState('error')
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera()
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
    }
  }, [stopCamera])

  // QR scanning using jsQR
  const startQRScanning = () => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    scanIntervalRef.current = setInterval(async () => {
      const video = videoRef.current
      if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) return

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

      try {
        // Dynamic import of jsQR — gracefully skip if not installed yet
        let jsQR: ((data: Uint8ClampedArray, width: number, height: number, options?: { inversionAttempts?: string }) => { data: string } | null) | null = null
        try {
          jsQR = (await import('jsqr' as string) as { default: typeof jsQR }).default
        } catch {
          // jsqr not installed yet — scanning unavailable
          return
        }
        if (!jsQR) return
        const qrResult = jsQR(imageData.data, canvas.width, canvas.height, {
          inversionAttempts: 'dontInvert',
        })

        if (!qrResult) return

        // Try to parse as PlantCraft QR
        const payload = JSON.parse(qrResult.data) as QRPayload
        if (payload.app !== 'plantcraft' || !payload.plantId) return

        // QR detected! Stop scanning
        if (scanIntervalRef.current) {
          clearInterval(scanIntervalRef.current)
          scanIntervalRef.current = null
        }

        setDetectedPayload(payload)
        
        // Subscribe to plant data from Firebase
        const unsub = await subscribeToPlant(
          payload.ownerUid,
          payload.plantId,
          (data) => {
            if (data) {
              setPlantData(data)
              setScanState('detected')
            } else {
              setErrorMsg('Plant owner hasn\'t enabled public sharing. Ask them to turn on Public Mode!')
              setScanState('error')
            }
          }
        )

        if (unsub) {
          unsubscribeRef.current = unsub
        } else {
          // Firebase not configured — show demo data
          setPlantData({
            name: 'Demo Plant',
            hp: 75,
            placedItems: [],
            lastUpdated: Date.now(),
          })
          setScanState('detected')
        }
      } catch {
        // Not a PlantCraft QR or parse error — continue scanning
      }
    }, 300)
  }

  const resetScan = () => {
    setScanState('idle')
    setPlantData(null)
    setDetectedPayload(null)
    setErrorMsg(null)
    stopCamera()
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }
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

  return (
    <div className="min-h-full px-4 py-4">
      {/* Header */}
      <div className="mb-4">
        <h2 className="font-pixel text-xs text-foreground">Scan Friend's Plant</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Point camera at a PlantCraft QR code to see friend's plants in AR!
        </p>
      </div>

      {/* Scanner Area */}
      <div className="relative aspect-square w-full overflow-hidden rounded-sm border-2 border-primary bg-muted">
        {scanState === 'scanning' ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />
            {/* Scanning overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative h-48 w-48">
                {/* Corner markers */}
                <div className="absolute left-0 top-0 h-6 w-6 border-l-4 border-t-4 border-accent" />
                <div className="absolute right-0 top-0 h-6 w-6 border-r-4 border-t-4 border-accent" />
                <div className="absolute bottom-0 left-0 h-6 w-6 border-b-4 border-l-4 border-accent" />
                <div className="absolute bottom-0 right-0 h-6 w-6 border-b-4 border-r-4 border-accent" />
                {/* Scanning line */}
                <div className="absolute left-2 right-2 h-0.5 bg-accent/80 ar-scanning-line" />
              </div>
            </div>
            {/* Status text */}
            <div className="absolute bottom-4 left-0 right-0 text-center">
              <span className="rounded-sm bg-black/60 px-3 py-1.5 font-pixel text-[8px] text-white">
                📷 Searching for PlantCraft QR...
              </span>
            </div>
          </>
        ) : scanState === 'detected' && plantData ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-primary/5 to-primary/20">
            {/* Plant Billboard */}
            <div className="w-full max-w-xs rounded-sm border-2 border-primary bg-card p-4 shadow-lg">
              {/* Plant status icon */}
              <div className="mb-3 text-4xl">
                {getStatusIcon(plantData.hp)}
              </div>

              {/* Plant name */}
              <h3 className="font-pixel text-sm text-primary">
                🌿 {plantData.name}
              </h3>

              {/* HP Display */}
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-pixel text-[8px] text-muted-foreground">HP</span>
                  <span
                    className="font-pixel text-xs font-bold"
                    style={{ color: getHpColor(plantData.hp) }}
                  >
                    ♥ {plantData.hp}/100
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-sm bg-muted">
                  <div
                    className="h-full rounded-sm transition-all duration-700"
                    style={{
                      width: `${plantData.hp}%`,
                      background: getHpColor(plantData.hp),
                      backgroundImage: `linear-gradient(90deg, ${getHpColor(plantData.hp)}99, ${getHpColor(plantData.hp)})`,
                    }}
                  />
                </div>
              </div>

              {/* Status badge */}
              <div className="mt-3">
                <span
                  className="inline-block rounded-sm px-2 py-1 font-pixel text-[8px]"
                  style={{
                    background: `${getHpColor(plantData.hp)}22`,
                    color: getHpColor(plantData.hp),
                  }}
                >
                  {plantData.hp >= 70 ? 'Healthy' : plantData.hp >= 40 ? 'Needs Attention' : 'Critical!'}
                </span>
              </div>

              {/* Items count */}
              {plantData.placedItems && plantData.placedItems.length > 0 && (
                <p className="mt-2 font-pixel text-[8px] text-muted-foreground">
                  🎨 {plantData.placedItems.length} decorative items
                </p>
              )}

              {/* Last updated */}
              <p className="mt-2 text-[10px] text-muted-foreground">
                Updated: {new Date(plantData.lastUpdated).toLocaleString('en-US')}
              </p>
            </div>

            {/* Realtime indicator */}
            <div className="mt-3 flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="font-pixel text-[8px] text-muted-foreground">
                Tracking realtime
              </span>
            </div>
          </div>
        ) : scanState === 'error' ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center">
            <span className="text-5xl">❌</span>
            <p className="mt-4 font-pixel text-xs text-foreground">
              {errorMsg || 'An error occurred'}
            </p>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="text-5xl">🔍</span>
            <p className="mt-4 font-pixel text-[10px] text-muted-foreground">
              Tap button below to start scanning
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 space-y-2">
        {scanState === 'idle' && (
          <Button
            onClick={startCamera}
            className="w-full rounded-sm bg-primary font-pixel text-xs text-primary-foreground hover:bg-primary/90"
          >
            📷 Start Scan
          </Button>
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

        {(scanState === 'detected' || scanState === 'error') && (
          <Button
            onClick={resetScan}
            className="w-full rounded-sm bg-primary font-pixel text-xs text-primary-foreground hover:bg-primary/90"
          >
            🔄 Scan another plant
          </Button>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-6 rounded-sm border border-border bg-secondary/50 p-4">
        <h3 className="font-pixel text-[10px] text-foreground">How to use:</h3>
        <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
          <li className="flex gap-2">
            <span className="text-accent">1.</span>
            Ask friend to open their plant's QR page
          </li>
          <li className="flex gap-2">
            <span className="text-accent">2.</span>
            Point camera at the QR code on screen or printed paper
          </li>
          <li className="flex gap-2">
            <span className="text-accent">3.</span>
            View plant info and HP in realtime!
          </li>
        </ul>
      </div>
    </div>
  )
}
