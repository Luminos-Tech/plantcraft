'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Camera, ImagePlus, Plus, Upload } from 'lucide-react'
import { useGameStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface AddPlantModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddPlantModal({ open, onOpenChange }: AddPlantModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
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

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }
  }, [])

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
    addPlant(name.trim(), imageUrl, description.trim())
    setName('')
    setDescription('')
    setImageUrl('')
    onOpenChange(false)
  }

  const handleClose = () => {
    stopCamera()
    setName('')
    setDescription('')
    setImageUrl('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto rounded-lg border-2 border-primary bg-card/98 shadow-2xl scrollbar-hide sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-pixel text-sm text-primary">
            Add New Plant
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Give your plant a name, note, and photo.
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
              className="mt-1 rounded-md border-2 border-border bg-input font-sans"
            />
            <span className="mt-1 block text-right font-pixel text-[8px] text-muted-foreground">
              {name.length}/20
            </span>
          </div>

          {/* Description Input */}
          <div>
            <label className="font-pixel text-[10px] text-muted-foreground">
              Description
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 160))}
              placeholder="Where it lives, what it needs, or a cute note..."
              maxLength={160}
              className="mt-1 min-h-20 resize-none rounded-md border-2 border-border bg-input text-sm"
            />
            <span className="mt-1 block text-right font-pixel text-[8px] text-muted-foreground">
              {description.length}/160
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
            <div className="relative mt-1 aspect-square w-full overflow-hidden rounded-lg border-2 border-border bg-muted scanner-frame">
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
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md bg-primary font-pixel text-[10px] text-primary-foreground shadow-lg"
                  >
                    <Camera className="h-4 w-4" aria-hidden="true" />
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
                      className="rounded-md border-primary bg-card/90 font-pixel text-[8px]"
                    >
                      <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                      Camera
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-md border-primary bg-card/90 font-pixel text-[8px]"
                    >
                      <Upload className="h-3.5 w-3.5" aria-hidden="true" />
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
                  <div className="flex gap-3">
                    <button
                      onClick={startCamera}
                      className="flex min-h-[100px] min-w-[100px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-border bg-card/85 p-3 text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                    >
                      <Camera className="h-8 w-8" aria-hidden="true" />
                      <span className="font-pixel text-[8px]">Camera</span>
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex min-h-[100px] min-w-[100px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-border bg-card/85 p-3 text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                    >
                      <ImagePlus className="h-8 w-8" aria-hidden="true" />
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
            className="soft-button w-full rounded-md bg-primary font-pixel text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Plant
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
