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
export async function captureVideoFrame(videoElement: HTMLVideoElement): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = videoElement.videoWidth
  canvas.height = videoElement.videoHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(videoElement, 0, 0)

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.92)
  })
}
