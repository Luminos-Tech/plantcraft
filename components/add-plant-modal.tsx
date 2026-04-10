'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useGameStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17,8 12,3 7,8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

interface AddPlantModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddPlantModal({ open, onOpenChange }: AddPlantModalProps) {
  const [name, setName] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [isCapturing, setIsCapturing] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { addPlant } = useGameStore()

  const startCamera = useCallback(async () => {
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setIsCapturing(true)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.name : 'Unknown error'
      if (errorMessage === 'NotAllowedError') {
        setCameraError('Camera access denied. Please use file upload instead.')
      } else if (errorMessage === 'NotFoundError') {
        setCameraError('No camera found. Please use file upload instead.')
      } else {
        setCameraError('Camera unavailable. Please use file upload instead.')
      }
    }
  }, [])

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = 256
        canvas.height = 256
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Draw centered square crop
        const size = Math.min(img.width, img.height)
        const x = (img.width - size) / 2
        const y = (img.height - size) / 2

        ctx.drawImage(img, x, y, size, size, 0, 0, 256, 256)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        setImageUrl(dataUrl)
        setCameraError(null)
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setIsCapturing(false)
  }, [])

  useEffect(() => {
    if (isCapturing && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [isCapturing])

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return

    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Draw centered square crop
    const video = videoRef.current
    const size = Math.min(video.videoWidth, video.videoHeight)
    const x = (video.videoWidth - size) / 2
    const y = (video.videoHeight - size) / 2

    ctx.drawImage(video, x, y, size, size, 0, 0, 256, 256)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
    setImageUrl(dataUrl)
    stopCamera()
  }, [stopCamera])

  const handleSubmit = () => {
    if (!name.trim()) return
    addPlant(name.trim(), imageUrl)
    setName('')
    setImageUrl('')
    onOpenChange(false)
  }

  const handleClose = () => {
    stopCamera()
    setName('')
    setImageUrl('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm rounded-sm border-2 border-primary bg-card max-h-[90vh] overflow-y-auto scrollbar-hide">
        <DialogHeader>
          <DialogTitle className="font-pixel text-sm text-primary">
            Add New Plant
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Give your plant a name and take a photo!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pb-4">
          {/* Name Input */}
          <div>
            <label className="font-pixel text-[10px] text-muted-foreground">
              Plant Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 20))}
              placeholder="My lovely plant..."
              maxLength={20}
              className="mt-1 rounded-sm border-2 border-border font-sans"
            />
            <span className="mt-1 block text-right font-pixel text-[8px] text-muted-foreground">
              {name.length}/20
            </span>
          </div>

          {/* Photo Capture */}
          <div>
            <label className="font-pixel text-[10px] text-muted-foreground">
              Plant Photo
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div className="relative mt-1 aspect-square w-full overflow-hidden rounded-sm border-2 border-border bg-muted">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`h-full w-full object-cover ${isCapturing ? 'block' : 'hidden'}`}
              />
              {isCapturing ? (
                <>
                  <Button
                    onClick={capturePhoto}
                    className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-sm bg-primary font-pixel text-[10px] text-primary-foreground"
                  >
                    Capture
                  </Button>
                </>
              ) : imageUrl ? (
                <>
                  <img
                    src={imageUrl}
                    alt="Plant preview"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={startCamera}
                      className="rounded-sm border-primary font-pixel text-[8px]"
                    >
                      Camera
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-sm border-primary font-pixel text-[8px]"
                    >
                      Upload
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-4">
                  {cameraError && (
                    <p className="text-center font-pixel text-[8px] text-destructive">
                      {cameraError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={startCamera}
                      className="flex flex-col items-center gap-1 rounded-sm border-2 border-border p-3 text-muted-foreground hover:border-primary hover:text-foreground"
                    >
                      <CameraIcon className="h-8 w-8" />
                      <span className="font-pixel text-[8px]">Camera</span>
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center gap-1 rounded-sm border-2 border-border p-3 text-muted-foreground hover:border-primary hover:text-foreground"
                    >
                      <UploadIcon className="h-8 w-8" />
                      <span className="font-pixel text-[8px]">Upload</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="w-full rounded-sm bg-primary font-pixel text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            🌱 Add Plant
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
