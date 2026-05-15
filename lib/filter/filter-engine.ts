/**
 * FilterEngine — TikTok-style plant filter using TensorFlow.js COCO-SSD + Canvas 2D.
 * Detects "potted plant" in camera feed and draws item overlays at anchor positions.
 */

import { PlacedItem, ITEM_DEFAULT_ANCHOR } from '@/lib/store'

// Emoji fallback for each item category (until PNG sprites are ready)
const ITEM_EMOJI: Record<string, string> = {
  hat:     '🎩',
  glasses: '👓',
  block:   '🟫',
  vfx:     '✨',
}

const ITEM_COLORS: Record<string, string> = {
  hat:     '#E8C547',
  glasses: '#5C8A3C',
  block:   '#8B7355',
  vfx:     '#A855F7',
}

type BBox = [number, number, number, number] // [x, y, width, height]

export class FilterEngine {
  private video: HTMLVideoElement
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private rafId: number = 0
  private isRunning = false
  private model: import('@tensorflow-models/coco-ssd').ObjectDetection | null = null

  // Smoothed bounding box for less jittery rendering
  private smoothedBbox: BBox | null = null
  private readonly lerpFactor = 0.35

  // Callback to get category from itemId
  private getCategoryFn: ((itemId: string) => string) | null = null

  constructor(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
    this.video = video
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
  }

  /**
   * Load COCO-SSD model. Call once before start().
   * Returns the loaded model for reuse.
   */
  async loadModel(): Promise<void> {
    // Dynamic import to lazy-load TF.js (~8MB)
    await import('@tensorflow/tfjs' as string)
    const cocoSsd = await import('@tensorflow-models/coco-ssd' as string)
    this.model = await (cocoSsd as { load: (config: { base: string }) => Promise<import('@tensorflow-models/coco-ssd').ObjectDetection> }).load({ base: 'lite_mobilenet_v2' })
  }

  /**
   * Start the detection + rendering loop.
   * @param getItems - returns current items to draw
   * @param getCategory - returns category string for an itemId
   * @param onDetection - called each frame with detection status
   */
  start(
    getItems: () => PlacedItem[],
    getCategory: (itemId: string) => string,
    onDetection?: (detected: boolean, bbox: BBox | null) => void
  ): void {
    if (!this.model) {
      console.error('FilterEngine: model not loaded. Call loadModel() first.')
      return
    }

    this.getCategoryFn = getCategory
    this.isRunning = true

    const loop = async () => {
      if (!this.isRunning) return

      // Ensure canvas matches video dimensions
      if (this.canvas.width !== this.video.videoWidth || this.canvas.height !== this.video.videoHeight) {
        this.canvas.width = this.video.videoWidth
        this.canvas.height = this.video.videoHeight
      }

      // Only detect if video is ready
      if (this.video.readyState >= this.video.HAVE_ENOUGH_DATA) {
        try {
          const predictions = await this.model!.detect(this.video)

          // Allow testing with common objects if a potted plant isn't perfectly recognized
          const validClasses = ['potted plant', 'vase', 'bottle', 'cup', 'bowl', 'apple', 'orange']
          const plant = predictions
            .filter((p: { class: string }) => validClasses.includes(p.class))
            .sort((a: { score: number }, b: { score: number }) => b.score - a.score)[0]

          // Clear canvas
          this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

          if (plant) {
            const rawBbox = plant.bbox as BBox

            // Smooth the bbox position using lerp
            if (this.smoothedBbox) {
              this.smoothedBbox = [
                this.lerp(this.smoothedBbox[0], rawBbox[0], this.lerpFactor),
                this.lerp(this.smoothedBbox[1], rawBbox[1], this.lerpFactor),
                this.lerp(this.smoothedBbox[2], rawBbox[2], this.lerpFactor),
                this.lerp(this.smoothedBbox[3], rawBbox[3], this.lerpFactor),
              ]
            } else {
              this.smoothedBbox = [...rawBbox]
            }

            this.drawDetectionFeedback(this.smoothedBbox)
            this.drawItems(this.smoothedBbox, getItems())
            onDetection?.(true, this.smoothedBbox)
          } else {
            this.smoothedBbox = null
            this.drawNoPlantHint()
            onDetection?.(false, null)
          }
        } catch (err) {
          console.warn('FilterEngine detection error:', err)
        }
      }

      this.rafId = requestAnimationFrame(loop)
    }

    loop()
  }

  /**
   * Stop the detection loop.
   */
  stop(): void {
    this.isRunning = false
    cancelAnimationFrame(this.rafId)
    this.smoothedBbox = null
  }

  /**
   * Get the last detected bounding box (for tap-to-place calculation).
   */
  getLastBbox(): BBox | null {
    return this.smoothedBbox
  }

  // ─── Drawing Methods ────────────────────────────────────────────────────

  private drawItems(bbox: BBox, items: PlacedItem[]): void {
    const [bx, by, bw, bh] = bbox

    for (const item of items) {
      const category = this.getCategoryFn?.(item.itemId) || 'block'
      const emoji = ITEM_EMOJI[category] || '📦'
      const color = ITEM_COLORS[category] || '#5C8A3C'

      // Calculate pixel position from anchor ratios
      const drawW = bw * item.scaleRatio
      const drawH = drawW // keep 1:1 aspect ratio
      const drawX = bx + bw * item.anchorX - drawW / 2
      const drawY = by + bh * item.anchorY - drawH / 2

      // Draw background box with glow
      this.ctx.save()
      this.ctx.shadowColor = color + '88'
      this.ctx.shadowBlur = 12
      this.ctx.fillStyle = color + '33'
      this.ctx.strokeStyle = color
      this.ctx.lineWidth = 2
      this.ctx.beginPath()
      this.ctx.roundRect(drawX, drawY, drawW, drawH, 4)
      this.ctx.fill()
      this.ctx.stroke()
      this.ctx.restore()

      // Draw emoji centered in the box
      const fontSize = Math.max(16, drawW * 0.6)
      this.ctx.font = `${fontSize}px serif`
      this.ctx.textAlign = 'center'
      this.ctx.textBaseline = 'middle'
      this.ctx.fillText(emoji, drawX + drawW / 2, drawY + drawH / 2)
    }
  }

  private drawDetectionFeedback(bbox: BBox): void {
    const [x, y, w, h] = bbox
    this.ctx.save()
    this.ctx.strokeStyle = 'rgba(92, 138, 60, 0.6)'
    this.ctx.lineWidth = 2
    this.ctx.setLineDash([8, 4])
    this.ctx.strokeRect(x, y, w, h)
    this.ctx.setLineDash([])

    // Corner markers
    const cornerLen = 12
    this.ctx.strokeStyle = '#5C8A3C'
    this.ctx.lineWidth = 3
    // top-left
    this.ctx.beginPath(); this.ctx.moveTo(x, y + cornerLen); this.ctx.lineTo(x, y); this.ctx.lineTo(x + cornerLen, y); this.ctx.stroke()
    // top-right
    this.ctx.beginPath(); this.ctx.moveTo(x + w - cornerLen, y); this.ctx.lineTo(x + w, y); this.ctx.lineTo(x + w, y + cornerLen); this.ctx.stroke()
    // bottom-left
    this.ctx.beginPath(); this.ctx.moveTo(x, y + h - cornerLen); this.ctx.lineTo(x, y + h); this.ctx.lineTo(x + cornerLen, y + h); this.ctx.stroke()
    // bottom-right
    this.ctx.beginPath(); this.ctx.moveTo(x + w - cornerLen, y + h); this.ctx.lineTo(x + w, y + h); this.ctx.lineTo(x + w, y + h - cornerLen); this.ctx.stroke()

    this.ctx.restore()
  }

  private drawNoPlantHint(): void {
    // Rely on React DOM overlay in page.tsx for this hint instead
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t
  }
}
