import { DiagnosisResult } from '@/lib/store'

/**
 * Client-side helper to call the /api/diagnose endpoint.
 * Converts a File/Blob to base64 and sends it to the server.
 */

async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1] // Remove "data:image/...;base64," prefix
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function diagnosePlant(
  imageFile: File | Blob,
  plantName: string
): Promise<DiagnosisResult | null> {
  try {
    const imageBase64 = await fileToBase64(imageFile)
    const mimeType = imageFile.type || 'image/jpeg'

    const response = await fetch('/api/diagnose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64,
        mimeType,
        plantName,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `HTTP ${response.status}`)
    }

    const result: DiagnosisResult = await response.json()
    return result
  } catch (error) {
    console.error('diagnosePlant error:', error)
    return null
  }
}

/**
 * Capture a frame from a video element as a JPEG Blob.
 */
export async function captureVideoFrame(
  videoElement: HTMLVideoElement,
  options: { maxSize?: number; quality?: number } = {}
): Promise<Blob> {
  const sourceWidth = videoElement.videoWidth || videoElement.clientWidth || 1
  const sourceHeight = videoElement.videoHeight || videoElement.clientHeight || 1
  const maxSize = options.maxSize ?? Math.max(sourceWidth, sourceHeight)
  const scale = Math.min(1, maxSize / Math.max(sourceWidth, sourceHeight))
  const outputWidth = Math.max(1, Math.round(sourceWidth * scale))
  const outputHeight = Math.max(1, Math.round(sourceHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = outputWidth
  canvas.height = outputHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(videoElement, 0, 0, outputWidth, outputHeight)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Could not capture camera frame.'))
    }, 'image/jpeg', options.quality ?? 0.92)
  })
}
