'use client'

import { Suspense, useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  FileImage,
  Loader2,
  QrCode,
  RotateCcw,
  ScanLine,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { subscribeToPlant, type PublicPlantData, type QRPayload } from '@/lib/firebase/plant-sync'
import { useGameStore } from '@/lib/store'
import { FriendPlantCard } from '@/components/friend-plant-card'

type ScanState = 'idle' | 'scanning' | 'loading' | 'detected' | 'error'

function ScanFriendContent() {
  const searchParams = useSearchParams()
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [plantData, setPlantData] = useState<PublicPlantData | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [detectedPayload, setDetectedPayload] = useState<QRPayload | null>(null)
  const [isProcessingUpload, setIsProcessingUpload] = useState(false)

  const scanVideoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const jsQRRef = useRef<((data: Uint8ClampedArray, w: number, h: number, opts?: { inversionAttempts?: string }) => { data: string } | null) | null>(null)

  const { friendPlants, addFriendPlant } = useGameStore()

  // ─── Pre-load jsQR library ─────────────────────────────────────────────────

  useEffect(() => {
    import('jsqr' as string)
      .then((mod: { default?: unknown }) => {
        jsQRRef.current = (mod.default ?? mod) as typeof jsQRRef.current
        console.log('[PlantCraft] jsQR loaded successfully')
      })
      .catch((err: unknown) => {
        console.error('[PlantCraft] Failed to load jsQR:', err)
      })
  }, [])

  // ─── Camera helpers ────────────────────────────────────────────────────────

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

  const clearLoadingTimeout = useCallback(() => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current)
      loadingTimeoutRef.current = null
    }
  }, [])

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 960 },
          height: { ideal: 540 },
          frameRate: { ideal: 24, max: 30 },
        },
      })
      streamRef.current = stream

      // Attach stream directly to video — don't rely on useEffect
      const video = scanVideoRef.current
      if (video) {
        video.srcObject = stream
        try {
          await video.play()
        } catch (playErr) {
          console.warn('[PlantCraft] video.play() failed, relying on autoPlay:', playErr)
        }
      }

      setScanState('scanning')

      // Wait for video to be ready before starting QR scanning
      if (video) {
        const onReady = () => {
          video.removeEventListener('loadeddata', onReady)
          startQRScanning()
        }
        if (video.readyState >= 2) {
          startQRScanning()
        } else {
          video.addEventListener('loadeddata', onReady)
        }
      }
    } catch (err) {
      console.error('[PlantCraft] Camera error:', err)
      setErrorMsg('Unable to open camera. Please grant camera permissions.')
      setScanState('error')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera()
      clearLoadingTimeout()
      unsubscribeRef.current?.()
    }
  }, [clearLoadingTimeout, stopCamera])

  // ─── Process detected QR payload ──────────────────────────────────────────

  const processPayload = useCallback(async (payload: QRPayload) => {
    if (!payload.ownerUid || !payload.plantId) {
      setErrorMsg('This PlantCraft share is missing plant information.')
      setScanState('error')
      return
    }

    setDetectedPayload(payload)
    setErrorMsg(null)
    setPlantData(null)
    setScanState('loading')
    unsubscribeRef.current?.()
    unsubscribeRef.current = null
    clearLoadingTimeout()
    stopCamera() // Stop camera after successful detection

    loadingTimeoutRef.current = setTimeout(() => {
      unsubscribeRef.current?.()
      unsubscribeRef.current = null
      setErrorMsg('Timed out loading this shared plant. Make sure Public Mode is on, Firebase Realtime Database rules allow reads, and the owner is using the newest QR.')
      setScanState('error')
    }, 8000)

    const unsub = await subscribeToPlant(payload.ownerUid, payload.plantId, (data) => {
      clearLoadingTimeout()
      if (data) {
        setPlantData(data)
        setScanState('detected')
        // Save to Friend's Garden
        addFriendPlant(payload.ownerUid, payload.plantId, {
          name: data.name,
          description: data.description,
          hp: data.hp,
          placedItems: data.placedItems ?? [],
          lastUpdated: data.lastUpdated,
        })
      } else {
        setErrorMsg("Plant owner hasn't enabled public sharing. Ask them to turn on Public Mode!")
        setScanState('error')
      }
    }, (error) => {
      clearLoadingTimeout()
      console.error('[PlantCraft] Firebase shared plant read failed:', error)
      setErrorMsg(`Could not read this shared plant from Firebase: ${error.message || 'check database rules and network.'}`)
      setScanState('error')
    })

    if (unsub) {
      unsubscribeRef.current = unsub
    } else {
      clearLoadingTimeout()
      // Firebase not configured — demo data
      const demoData = { name: 'Demo Plant', description: 'Firebase is not configured, so this is a local preview.', hp: 75, placedItems: [] as PublicPlantData['placedItems'], lastUpdated: Date.now() }
      setPlantData(demoData)
      setScanState('detected')
      addFriendPlant(payload.ownerUid, payload.plantId, demoData)
    }
  }, [addFriendPlant, clearLoadingTimeout, stopCamera])

  useEffect(() => {
    const ownerUid = searchParams.get('ownerUid')
    const plantId = searchParams.get('plantId')
    if (!ownerUid || !plantId || detectedPayload) return

    processPayload({
      app: 'plantcraft',
      ownerUid,
      plantId,
      version: 1,
    })
  }, [detectedPayload, processPayload, searchParams])

  // ─── QR Scanning via camera ───────────────────────────────────────────────

  const startQRScanning = () => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    console.log('[PlantCraft] QR scanning started')

    scanIntervalRef.current = setInterval(() => {
      const video = scanVideoRef.current
      if (!video || video.readyState < video.HAVE_ENOUGH_DATA) return

      const jsQR = jsQRRef.current
      if (!jsQR) {
        console.warn('[PlantCraft] jsQR not loaded yet, waiting...')
        return
      }

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

      try {
        // Try both normal and inverted QR detection for better results
        let qrResult = jsQR(imageData.data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' })
        if (!qrResult) {
          qrResult = jsQR(imageData.data, canvas.width, canvas.height, { inversionAttempts: 'attemptBoth' })
        }
        if (!qrResult) return

        let payload: QRPayload
        try {
          payload = JSON.parse(qrResult.data) as QRPayload
        } catch {
          return // Not valid JSON — continue scanning
        }
        if (payload.app !== 'plantcraft' || !payload.plantId) return

        console.log('[PlantCraft] QR detected:', payload)

        // Stop scan loop
        if (scanIntervalRef.current) {
          clearInterval(scanIntervalRef.current)
          scanIntervalRef.current = null
        }

        processPayload(payload)
      } catch {
        // Not a PlantCraft QR — continue scanning
      }
    }, 250) // Scan faster: every 250ms instead of 300ms
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

      // Use pre-loaded jsQR, or try loading again if not available
      let jsQR = jsQRRef.current
      if (!jsQR) {
        try {
          const mod = await import('jsqr' as string) as { default?: unknown }
          jsQR = (mod.default ?? mod) as typeof jsQRRef.current
          if (jsQR) jsQRRef.current = jsQR
        } catch {
          setErrorMsg('QR scanning library not available.')
          setIsProcessingUpload(false)
          return
        }
      }
      if (!jsQR) {
        setErrorMsg('QR scanning library not available.')
        setIsProcessingUpload(false)
        return
      }

      const qrResult = jsQR(imageData.data, canvas.width, canvas.height, { inversionAttempts: 'attemptBoth' })
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
    clearLoadingTimeout()
    stopCamera()
    unsubscribeRef.current?.()
    unsubscribeRef.current = null
  }

  const getHpColor = (hp: number) => {
    if (hp >= 70) return '#4CAF50'
    if (hp >= 40) return '#FFC107'
    return '#F44336'
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="page-stack">
      <section className="page-hero">
        <div className="page-container flex items-center justify-between gap-4 py-4 sm:py-5">
          <div className="min-w-0">
            <span className="section-kicker font-pixel text-[8px]">
              <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
              Friend Sync
            </span>
            <h2 className="text-balance mt-2.5 font-pixel text-sm text-foreground sm:text-base">Scan Friend&apos;s Plant</h2>
            <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">Shared garden scanner</p>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-1 rounded-md border border-primary/20 bg-secondary/50 px-4 py-2.5">
            <Users className="h-5 w-5 text-primary" aria-hidden="true" />
            <div className="font-pixel text-xl text-primary sm:text-2xl">{friendPlants.length}</div>
            <div className="font-pixel text-[7px] text-muted-foreground">
              friend{friendPlants.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </section>

      <div className="page-container grid gap-5 pt-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <section className="min-w-0">
          <div className="scanner-frame relative aspect-[4/3] w-full overflow-hidden rounded-lg border-2 border-primary bg-muted lg:aspect-[16/11]">
            <video
              ref={scanVideoRef}
              autoPlay
              playsInline
              muted
              className={`h-full w-full object-cover ${scanState === 'scanning' ? 'block' : 'hidden'}`}
            />

            {scanState === 'scanning' ? (
              <>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0_34%,rgba(0,0,0,0.28)_64%)]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative h-40 w-40 sm:h-52 sm:w-52">
                    <div className="absolute left-0 top-0 h-8 w-8 border-l-3 border-t-3 border-accent" />
                    <div className="absolute right-0 top-0 h-8 w-8 border-r-3 border-t-3 border-accent" />
                    <div className="absolute bottom-0 left-0 h-8 w-8 border-b-3 border-l-3 border-accent" />
                    <div className="absolute bottom-0 right-0 h-8 w-8 border-b-3 border-r-3 border-accent" />
                    <div className="absolute left-3 right-3 h-0.5 bg-accent/90 shadow-[0_0_16px_rgba(246,195,91,0.8)] ar-scanning-line" />
                  </div>
                </div>
                <div className="absolute bottom-4 left-0 right-0 text-center">
                  <span className="inline-flex items-center gap-2 rounded-md bg-black/65 px-3 py-2 font-pixel text-[8px] text-white shadow-lg backdrop-blur-sm">
                    <ScanLine className="h-3.5 w-3.5" aria-hidden="true" />
                    Searching for PlantCraft QR...
                  </span>
                </div>
              </>
            ) : scanState === 'detected' && plantData ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-primary/5 to-primary/15 p-4 text-center">
                <div className="w-full max-w-xs rounded-lg border-2 border-primary bg-card/95 p-4 shadow-lg">
                  <CheckCircle2 className="mx-auto mb-2 h-9 w-9 text-primary" aria-hidden="true" />
                  <h3 className="break-words font-pixel text-xs text-primary">{plantData.name}</h3>
                  {plantData.description && (
                    <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                      {plantData.description}
                    </p>
                  )}

                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-pixel text-[7px] text-muted-foreground">HP</span>
                      <span className="font-pixel text-[10px] font-bold" style={{ color: getHpColor(plantData.hp) }}>
                        {plantData.hp}/100
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted ring-1 ring-border/70">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${plantData.hp}%`, background: getHpColor(plantData.hp) }}
                      />
                    </div>
                  </div>

                  <p className="mt-3 font-pixel text-[8px] text-primary">Added to Friend&apos;s Garden</p>
                </div>
              </div>
            ) : scanState === 'loading' ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden="true" />
                <p className="font-pixel text-[10px] text-muted-foreground">Loading shared plant...</p>
              </div>
            ) : scanState === 'error' ? (
              <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                <AlertTriangle className="h-10 w-10 text-destructive" aria-hidden="true" />
                <p className="mt-3 max-w-xs font-pixel text-[10px] leading-relaxed text-foreground">
                  {errorMsg || 'An error occurred'}
                </p>
              </div>
            ) : isProcessingUpload ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden="true" />
                <p className="font-pixel text-[10px] text-muted-foreground">Reading QR code...</p>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <div className="rounded-full bg-secondary p-4 ring-1 ring-border">
                  <QrCode className="h-10 w-10 text-primary" aria-hidden="true" />
                </div>
                <p className="font-pixel text-[10px] leading-relaxed text-muted-foreground">
                  Camera scan or QR image upload
                </p>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUploadQR}
          />

          <div className="mt-3 space-y-2">
            {(scanState === 'idle' || isProcessingUpload) && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={startCamera}
                  disabled={isProcessingUpload}
                  className="soft-button min-h-11 rounded-md bg-primary font-pixel text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <Camera className="h-4 w-4" aria-hidden="true" />
                  Camera
                </Button>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessingUpload}
                  variant="outline"
                  className="soft-button min-h-11 rounded-md border-2 border-primary bg-card/85 font-pixel text-xs disabled:opacity-50"
                >
                  {isProcessingUpload ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileImage className="h-4 w-4" aria-hidden="true" />}
                  Upload QR
                </Button>
              </div>
            )}

            {scanState === 'scanning' && (
              <Button
                variant="outline"
                onClick={() => { stopCamera(); setScanState('idle') }}
                className="soft-button min-h-11 w-full rounded-md border-2 border-primary bg-card/85 font-pixel text-xs"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                Cancel
              </Button>
            )}

            {scanState === 'detected' && plantData && detectedPayload && (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href={`/camera?friendOwner=${detectedPayload.ownerUid}&friendPlant=${detectedPayload.plantId}`}
                  className="soft-button flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-3 py-2 font-pixel text-xs text-accent-foreground transition-colors hover:bg-accent/90"
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  View AR
                </Link>
                <Button
                  onClick={resetScan}
                  variant="outline"
                  className="soft-button min-h-11 rounded-md border-2 border-primary bg-card/85 font-pixel text-xs"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Scan another
                </Button>
              </div>
            )}

            {scanState === 'error' && (
              <Button
                onClick={resetScan}
                className="soft-button min-h-11 w-full rounded-md bg-primary font-pixel text-xs text-primary-foreground hover:bg-primary/90"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Try again
              </Button>
            )}
          </div>
        </section>

        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3 rounded-md bg-secondary/40 px-3 py-2">
            <h2 className="flex items-center gap-2 font-pixel text-xs text-foreground">
              <Users className="h-4 w-4 text-primary" aria-hidden="true" />
              Friend&apos;s Garden
            </h2>
            <span className="font-pixel text-[8px] text-muted-foreground">
              {friendPlants.length} plant{friendPlants.length !== 1 ? 's' : ''}
            </span>
          </div>

          {friendPlants.length === 0 ? (
            <div className="surface-panel flex min-h-48 flex-col items-center justify-center px-4 py-8 text-center">
              <Users className="h-9 w-9 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 font-pixel text-[10px] text-muted-foreground">
                No friend plants yet
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {friendPlants.map((friend) => (
                <FriendPlantCard key={friend.id} friend={friend} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default function ScanFriendPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-full items-center justify-center font-pixel text-xs">
        Loading...
      </div>
    }>
      <ScanFriendContent />
    </Suspense>
  )
}
