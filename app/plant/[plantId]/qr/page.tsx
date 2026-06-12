'use client'

import { use, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useGameStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { publishToFirebase, unpublishFromFirebase } from '@/lib/firebase/plant-sync'
import type { QRPayload } from '@/lib/firebase/plant-sync'

interface PageProps {
  params: Promise<{ plantId: string }>
}

export default function PlantQRPage({ params }: PageProps) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { plants, getPlantHp, setPlantPublic } = useGameStore()
  
  const plant = plants.find((p) => p.id === resolvedParams.plantId)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [isPublic, setIsPublic] = useState(plant?.isPublic ?? false)
  const [isToggling, setIsToggling] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [shareNotice, setShareNotice] = useState<string | null>(null)
  const [ownerUid] = useState(() => {
    // Generate a persistent anonymous UID for this device
    if (typeof window === 'undefined') return 'anon'
    let uid = localStorage.getItem('plantcraft_uid')
    if (!uid) {
      uid = 'user_' + crypto.randomUUID().slice(0, 8)
      localStorage.setItem('plantcraft_uid', uid)
    }
    return uid
  })

  // Generate QR code
  const generateQR = useCallback(async () => {
    if (!plant) return

    const payload: QRPayload = {
      app: 'plantcraft',
      plantId: plant.id,
      ownerUid,
      version: 1,
    }

    try {
      // Dynamic import of qrcode library — falls back to pattern if not installed
      const QRCodeLib = await import('qrcode' as string).catch(() => null) as null | { default: { toDataURL: (data: string, opts: object) => Promise<string> } }
      if (!QRCodeLib) {
        setQrDataUrl(null)
        return
      }
      const QRCode = QRCodeLib.default
      const dataUrl = await QRCode.toDataURL(JSON.stringify(payload), {
        width: 300,
        margin: 2,
        color: {
          dark: '#2D4A1E',
          light: '#F5F0E8',
        },
        errorCorrectionLevel: 'H',
      })
      setQrDataUrl(dataUrl)
    } catch (error) {
      console.error('QR generation error:', error)
      // Fallback: generate a simple visual pattern
      setQrDataUrl(null)
    }
  }, [plant, ownerUid])

  useEffect(() => {
    generateQR()
  }, [generateQR])

  // Toggle public mode
  const handleTogglePublic = async () => {
    if (!plant) return
    setIsToggling(true)
    setShareError(null)
    setShareNotice(null)

    try {
      const newPublicState = !isPublic

      if (newPublicState) {
        const hp = getPlantHp(plant.id)
        const publicPlant = {
          ...plant,
          isPublic: true,
          placedItems: (plant.placedItems || []).map((item) => ({
            ...item,
            isShared: true,
          })),
        }
        const success = await publishToFirebase(publicPlant, ownerUid, hp)
        if (success) {
          setIsPublic(true)
          setPlantPublic(plant.id, true)
        } else {
          setShareError('Could not enable sharing. Check Firebase configuration or network.')
        }
      } else {
        const success = await unpublishFromFirebase(plant.id, ownerUid)
        if (success) {
          setIsPublic(false)
          setPlantPublic(plant.id, false)
        } else {
          setShareError('Could not disable sharing. Check Firebase configuration or network.')
        }
      }
    } catch (error) {
      console.error('Toggle public error:', error)
      setShareError('Sharing failed. Please try again.')
    } finally {
      setIsToggling(false)
    }
  }

  // Download QR as PNG
  const handleDownloadQR = () => {
    if (!qrDataUrl || !plant) return

    const link = document.createElement('a')
    link.download = `PlantCraft_${plant.name}_QR.png`
    link.href = qrDataUrl
    link.click()
  }

  if (!plant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <span className="text-4xl">❓</span>
        <h2 className="mt-4 font-pixel text-sm text-foreground">Plant not found</h2>
        <Button
          onClick={() => router.push('/dashboard')}
          className="mt-6 rounded-sm bg-primary font-pixel text-xs text-primary-foreground"
        >
          Back to Garden
        </Button>
      </div>
    )
  }

  const hp = getPlantHp(plant.id)
  const placedItemCount = plant.placedItems?.length ?? 0
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/scan-friend?ownerUid=${encodeURIComponent(ownerUid)}&plantId=${encodeURIComponent(plant.id)}`
    : ''

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      {/* QR Code Card */}
      <div className="w-full max-w-sm rounded-sm border-2 border-primary bg-card p-6 text-center shadow-lg">
        {/* Plant Info */}
        <div className="mb-4">
          <span className="text-3xl">🌿</span>
          <h2 className="mt-2 font-pixel text-sm text-foreground">{plant.name}</h2>
          {plant.description && (
            <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground">
              {plant.description}
            </p>
          )}
          <p className="mt-1 font-pixel text-[8px] text-muted-foreground">
            HP: {hp}/100 • Items: {placedItemCount}
          </p>
        </div>

        {/* QR Code */}
        <div className="flex justify-center">
          {qrDataUrl ? (
            <div className="rounded-sm border-2 border-primary/30 p-2 bg-[#F5F0E8]">
              <img
                src={qrDataUrl}
                alt={`QR code for ${plant.name}`}
                width={250}
                height={250}
                className="rounded-sm"
              />
            </div>
          ) : (
            <FallbackQRPattern plantId={plant.id} />
          )}
        </div>

        {/* Public Mode Toggle */}
        <div className="mt-4 flex items-center justify-between rounded-sm border border-border bg-secondary/50 p-3">
          <div className="text-left">
            <p className="font-pixel text-[8px] text-foreground">
              {isPublic ? '🌐 Sharing' : '🔒 Private'}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {isPublic
                ? 'Friends can see HP via QR'
                : 'Enable sharing to show friends'}
            </p>
          </div>
          <button
            onClick={handleTogglePublic}
            disabled={isToggling}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              isPublic ? 'bg-primary' : 'bg-muted'
            } ${isToggling ? 'opacity-50' : ''}`}
          >
            <div
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                isPublic ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {shareError && (
          <p className="mt-3 rounded-sm border border-destructive/30 bg-destructive/10 px-3 py-2 text-left text-xs text-destructive">
            {shareError}
          </p>
        )}

        {shareNotice && (
          <p className="mt-3 rounded-sm border border-primary/25 bg-primary/10 px-3 py-2 text-left text-xs text-primary">
            {shareNotice}
          </p>
        )}

        {isPublic && shareUrl && (
          <div className="mt-4 rounded-sm border border-primary/25 bg-primary/5 p-3 text-left">
            <p className="font-pixel text-[8px] text-primary">Friend Link</p>
            <p className="mt-1 break-all text-[10px] text-muted-foreground">{shareUrl}</p>
          </div>
        )}

        {/* Instructions */}
        <p className="mt-4 text-xs text-muted-foreground">
          Friends can scan this QR or open the share link after Public Mode is enabled.
        </p>
      </div>

      {/* Actions */}
      <div className="mt-6 flex gap-3">
        <Button
          variant="outline"
          onClick={() => router.push('/dashboard')}
          className="rounded-sm border-2 border-primary font-pixel text-xs"
        >
          ← Back
        </Button>
        {qrDataUrl && (
          <Button
            onClick={handleDownloadQR}
            className="rounded-sm bg-accent font-pixel text-xs text-accent-foreground hover:bg-accent/90"
          >
            📥 Download QR
          </Button>
        )}
        <Button
          disabled={!isPublic}
          onClick={async () => {
            if (!shareUrl || !plant) return
            setShareNotice(null)
            if (navigator.share) {
              await navigator.share({
                title: `View ${plant.name} on PlantCraft!`,
                text: `Open this PlantCraft share to add ${plant.name} to your Friend's Garden.`,
                url: shareUrl,
              })
            } else {
              await navigator.clipboard?.writeText(shareUrl)
              setShareNotice('Share link copied to clipboard.')
            }
          }}
          title={isPublic ? 'Share friend link' : 'Enable sharing first'}
          className="rounded-sm bg-primary font-pixel text-xs text-primary-foreground disabled:opacity-50"
        >
          📤 Share
        </Button>
      </div>
    </div>
  )
}

// Fallback visual QR pattern when qrcode library isn't available
function FallbackQRPattern({ plantId }: { plantId: string }) {
  const hash = plantId.split('').reduce((a, b) => {
    const h = (a << 5) - a + b.charCodeAt(0)
    return h & h
  }, 0)

  const pattern = Array.from({ length: 49 }, (_, i) => {
    const row = Math.floor(i / 7)
    const col = i % 7
    if (row < 2 && col < 2) return true
    if (row < 2 && col > 4) return true
    if (row > 4 && col < 2) return true
    return ((hash >> (i % 30)) & 1) === 1
  })

  return (
    <div className="grid grid-cols-7 gap-1 bg-[#F5F0E8] p-4 rounded-sm border-2 border-primary/30">
      {pattern.map((filled, i) => (
        <div
          key={i}
          className={`aspect-square w-6 rounded-sm ${
            filled ? 'bg-[#2D4A1E]' : 'bg-[#F5F0E8]'
          }`}
        />
      ))}
    </div>
  )
}
