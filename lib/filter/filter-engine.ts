/**
 * FilterEngine — stable camera overlay for PlantCraft decoration mode.
 *
 * The previous version rendered directly in raw video coordinates while the
 * video element was displayed with object-cover. That made taps and overlays
 * drift on phones. This engine draws in CSS screen pixels, maps detections
 * through the same object-cover transform, and supports a locked plant frame
 * so decorations stay fixed instead of following every noisy detection frame.
 */

import type { PlacedItem } from '@/lib/store'

export type BBox = [number, number, number, number]
export type ARAnchorSource = 'vision' | 'locked' | 'manual'

export interface ARFrameState {
  anchor: BBox | null
  detected: boolean
  locked: boolean
  source: ARAnchorSource | null
  label: string
}

interface Prediction {
  bbox: BBox
  class: string
  score: number
}

interface StartOptions {
  autoLock?: boolean
}

const PLANT_CLASSES = new Set(['potted plant', 'vase', 'bottle', 'cup', 'bowl'])

const ITEM_COLORS: Record<string, string> = {
  hat: '#E8C547',
  glasses: '#1F2933',
  block: '#8B7355',
  vfx: '#A855F7',
}

const LAYER_ORDER: Record<string, number> = {
  vfx: 0,
  block: 1,
  glasses: 2,
  hat: 3,
}

export class FilterEngine {
  private video: HTMLVideoElement
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private rafId = 0
  private isRunning = false
  private model: import('@tensorflow-models/coco-ssd').ObjectDetection | null = null

  private suggestedAnchor: BBox | null = null
  private lockedAnchor: BBox | null = null
  private detectionInFlight = false
  private lastDetectionAt = 0
  private lastDetectionHitAt = -Infinity
  private stableHits = 0
  private lastStateKey = ''

  private readonly detectionIntervalMs = 260
  private readonly detectionFreshMs = 1100
  private readonly maxDpr = 2

  private getCategoryFn: ((itemId: string) => string) | null = null
  private onStateChange: ((state: ARFrameState) => void) | null = null
  private options: StartOptions = {}

  constructor(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
    this.video = video
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('FilterEngine: canvas 2D context is not available.')
    }
    this.ctx = ctx
  }

  async loadModel(): Promise<void> {
    try {
      await import('@tensorflow/tfjs' as string)
      const cocoSsd = await import('@tensorflow-models/coco-ssd' as string)
      this.model = await (cocoSsd as {
        load: (config: { base: string }) => Promise<import('@tensorflow-models/coco-ssd').ObjectDetection>
      }).load({ base: 'lite_mobilenet_v2' })
    } catch (err) {
      console.warn('FilterEngine: vision model unavailable, using manual anchor mode.', err)
      this.model = null
    }
  }

  start(
    getItems: () => PlacedItem[],
    getCategory: (itemId: string) => string,
    onStateChange?: (state: ARFrameState) => void,
    options: StartOptions = {}
  ): void {
    this.getCategoryFn = getCategory
    this.onStateChange = onStateChange ?? null
    this.options = options
    this.isRunning = true

    const loop = () => {
      if (!this.isRunning) return

      this.syncCanvasSize()
      this.clear()
      this.maybeDetect()

      const anchor = this.getRenderableAnchor()
      if (anchor) {
        this.drawItems(anchor, getItems())
      } else {
        this.drawScanningGuide()
      }

      this.emitState()
      this.rafId = requestAnimationFrame(loop)
    }

    loop()
  }

  stop(): void {
    this.isRunning = false
    cancelAnimationFrame(this.rafId)
    this.suggestedAnchor = null
    this.lockedAnchor = null
    this.detectionInFlight = false
    this.stableHits = 0
    this.lastStateKey = ''
  }

  getLastBbox(): BBox | null {
    return this.getRenderableAnchor()
  }

  getState(): ARFrameState {
    const anchor = this.getRenderableAnchor()
    const detected = this.hasFreshDetection()
    const locked = !!this.lockedAnchor
    const source: ARAnchorSource | null = locked ? 'locked' : detected && this.suggestedAnchor ? 'vision' : null

    return {
      anchor,
      detected,
      locked,
      source,
      label: locked ? 'Locked' : detected ? 'Tracking' : 'Manual',
    }
  }

  lockAnchor(): ARFrameState {
    this.lockedAnchor = this.copyBbox(this.suggestedAnchor ?? this.lockedAnchor ?? this.getDefaultAnchor())
    this.emitState(true)
    return this.getState()
  }

  unlockAnchor(): ARFrameState {
    this.lockedAnchor = null
    this.emitState(true)
    return this.getState()
  }

  resetAnchor(): ARFrameState {
    this.lockedAnchor = this.getDefaultAnchor()
    this.suggestedAnchor = this.copyBbox(this.lockedAnchor)
    this.emitState(true)
    return this.getState()
  }

  scaleLockedAnchor(factor: number): ARFrameState {
    const anchor = this.lockedAnchor ?? this.suggestedAnchor ?? this.getDefaultAnchor()
    const [x, y, w, h] = anchor
    const nextW = this.clamp(w * factor, 96, this.getCanvasCssWidth() * 0.96)
    const nextH = this.clamp(h * factor, 96, this.getCanvasCssHeight() * 0.8)
    this.lockedAnchor = this.constrainBbox([
      x + w / 2 - nextW / 2,
      y + h / 2 - nextH / 2,
      nextW,
      nextH,
    ])
    this.emitState(true)
    return this.getState()
  }

  moveLockedAnchor(dxRatio: number, dyRatio: number): ARFrameState {
    const anchor = this.lockedAnchor ?? this.suggestedAnchor ?? this.getDefaultAnchor()
    const dx = this.getCanvasCssWidth() * dxRatio
    const dy = this.getCanvasCssHeight() * dyRatio
    this.lockedAnchor = this.constrainBbox([anchor[0] + dx, anchor[1] + dy, anchor[2], anchor[3]])
    this.emitState(true)
    return this.getState()
  }

  private maybeDetect(): void {
    if (!this.model || this.lockedAnchor || this.detectionInFlight) return
    if (this.video.readyState < this.video.HAVE_ENOUGH_DATA) return

    const now = performance.now()
    if (now - this.lastDetectionAt < this.detectionIntervalMs) return

    this.lastDetectionAt = now
    this.detectionInFlight = true
    this.detectOnce()
      .catch((err) => console.warn('FilterEngine detection error:', err))
      .finally(() => {
        this.detectionInFlight = false
      })
  }

  private async detectOnce(): Promise<void> {
    if (!this.model) return

    const predictions = await this.model.detect(this.video, 6, 0.32) as Prediction[]
    const plant = predictions
      .filter((prediction) => PLANT_CLASSES.has(prediction.class))
      .sort((a, b) => b.score - a.score)[0]

    if (!plant) {
      this.stableHits = 0
      return
    }

    const mapped = this.videoBboxToCanvas(plant.bbox)
    const normalized = this.normalizePlantAnchor(mapped)

    this.suggestedAnchor = this.suggestedAnchor
      ? this.smoothBbox(this.suggestedAnchor, normalized)
      : normalized
    this.lastDetectionHitAt = performance.now()
    this.stableHits += 1

    if (this.options.autoLock && this.stableHits >= 3 && !this.lockedAnchor) {
      this.lockedAnchor = this.copyBbox(this.suggestedAnchor)
    }
  }

  private syncCanvasSize(): void {
    const width = Math.max(1, Math.round(this.canvas.clientWidth || window.innerWidth))
    const height = Math.max(1, Math.round(this.canvas.clientHeight || window.innerHeight))
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr)
    const pixelWidth = Math.round(width * dpr)
    const pixelHeight = Math.round(height * dpr)

    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth
      this.canvas.height = pixelHeight
    }

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.ctx.imageSmoothingEnabled = false
  }

  private clear(): void {
    this.ctx.clearRect(0, 0, this.getCanvasCssWidth(), this.getCanvasCssHeight())
  }

  private getRenderableAnchor(): BBox | null {
    if (this.lockedAnchor) return this.lockedAnchor
    if (this.suggestedAnchor && this.hasFreshDetection()) return this.suggestedAnchor
    return null
  }

  private getDefaultAnchor(): BBox {
    const width = this.getCanvasCssWidth()
    const height = this.getCanvasCssHeight()
    const frameWidth = Math.min(width * 0.72, 420)
    const frameHeight = Math.min(height * 0.46, frameWidth * 1.25)
    return [
      (width - frameWidth) / 2,
      Math.max(92, (height - frameHeight) / 2 - 18),
      frameWidth,
      frameHeight,
    ]
  }

  private videoBboxToCanvas([x, y, w, h]: BBox): BBox {
    const videoW = this.video.videoWidth || 1
    const videoH = this.video.videoHeight || 1
    const canvasW = this.getCanvasCssWidth()
    const canvasH = this.getCanvasCssHeight()
    const scale = Math.max(canvasW / videoW, canvasH / videoH)
    const offsetX = (canvasW - videoW * scale) / 2
    const offsetY = (canvasH - videoH * scale) / 2

    return [
      x * scale + offsetX,
      y * scale + offsetY,
      w * scale,
      h * scale,
    ]
  }

  private normalizePlantAnchor([x, y, w, h]: BBox): BBox {
    const padX = w * 0.12
    const padTop = h * 0.16
    const padBottom = h * 0.1
    return this.constrainBbox([
      x - padX,
      y - padTop,
      w + padX * 2,
      h + padTop + padBottom,
    ])
  }

  private smoothBbox(previous: BBox, next: BBox): BBox {
    const centerDistance = Math.hypot(
      previous[0] + previous[2] / 2 - (next[0] + next[2] / 2),
      previous[1] + previous[3] / 2 - (next[1] + next[3] / 2),
    )
    const relativeJump = centerDistance / Math.max(previous[2], previous[3], 1)
    const factor = this.clamp(0.34 + relativeJump * 0.45, 0.34, 0.62)

    return this.constrainBbox([
      this.deadzoneLerp(previous[0], next[0], factor),
      this.deadzoneLerp(previous[1], next[1], factor),
      this.deadzoneLerp(previous[2], next[2], factor),
      this.deadzoneLerp(previous[3], next[3], factor),
    ])
  }

  private drawItems(anchor: BBox, items: PlacedItem[]): void {
    const orderedItems = [...items].sort((a, b) => {
      const aCategory = this.getCategoryFn?.(a.itemId) ?? 'block'
      const bCategory = this.getCategoryFn?.(b.itemId) ?? 'block'
      return (LAYER_ORDER[aCategory] ?? 1) - (LAYER_ORDER[bCategory] ?? 1)
    })

    for (const item of orderedItems) {
      const category = this.getCategoryFn?.(item.itemId) ?? 'block'
      this.drawItem(anchor, item, category)
    }
  }

  private drawItem(anchor: BBox, item: PlacedItem, category: string): void {
    const [bx, by, bw, bh] = anchor
    const baseSize = category === 'vfx'
      ? Math.max(bw, bh) * item.scaleRatio
      : bw * item.scaleRatio
    const size = this.clamp(baseSize, category === 'vfx' ? 120 : 30, Math.max(bw, bh) * 1.35)
    const centerX = bx + bw * item.anchorX
    const centerY = by + bh * item.anchorY

    this.ctx.save()
    this.ctx.shadowColor = `${ITEM_COLORS[category] ?? '#5C8A3C'}66`
    this.ctx.shadowBlur = category === 'vfx' ? 18 : 10

    if (category === 'vfx') {
      this.drawVfx(anchor, item.itemId, size)
    } else if (item.itemId === 'hat-crown') {
      this.drawCrown(centerX, centerY, size)
    } else if (item.itemId === 'hat-straw' || category === 'hat') {
      this.drawStrawHat(centerX, centerY, size)
    } else if (item.itemId === 'glasses-heart') {
      this.drawHeartGlasses(centerX, centerY, size)
    } else if (item.itemId === 'glasses-cool' || category === 'glasses') {
      this.drawPixelGlasses(centerX, centerY, size)
    } else if (item.itemId === 'block-diamond') {
      this.drawDiamondBlock(centerX, centerY, size)
    } else {
      this.drawDirtBlock(centerX, centerY, size)
    }

    this.ctx.restore()
  }

  private drawScanningGuide(): void {
    const width = this.getCanvasCssWidth()
    const height = this.getCanvasCssHeight()
    const size = Math.min(width * 0.5, height * 0.28, 220)
    const x = (width - size) / 2
    const y = Math.max(112, (height - size) / 2 - 24)
    const corner = size * 0.22

    this.ctx.save()
    this.ctx.globalAlpha = 0.42
    this.ctx.strokeStyle = '#FFFFFF'
    this.ctx.lineWidth = 3
    this.ctx.setLineDash([8, 8])
    this.drawCorner(x, y, corner, 'tl')
    this.drawCorner(x + size, y, corner, 'tr')
    this.drawCorner(x, y + size, corner, 'bl')
    this.drawCorner(x + size, y + size, corner, 'br')
    this.ctx.setLineDash([])
    this.ctx.restore()
  }

  private drawCorner(x: number, y: number, length: number, corner: 'tl' | 'tr' | 'bl' | 'br'): void {
    this.ctx.beginPath()
    if (corner === 'tl') {
      this.ctx.moveTo(x, y + length)
      this.ctx.lineTo(x, y)
      this.ctx.lineTo(x + length, y)
    } else if (corner === 'tr') {
      this.ctx.moveTo(x - length, y)
      this.ctx.lineTo(x, y)
      this.ctx.lineTo(x, y + length)
    } else if (corner === 'bl') {
      this.ctx.moveTo(x, y - length)
      this.ctx.lineTo(x, y)
      this.ctx.lineTo(x + length, y)
    } else {
      this.ctx.moveTo(x - length, y)
      this.ctx.lineTo(x, y)
      this.ctx.lineTo(x, y - length)
    }
    this.ctx.stroke()
  }

  private drawStrawHat(cx: number, cy: number, size: number): void {
    const p = size / 16
    const x = cx - size / 2
    const y = cy - size / 2
    this.pixelRect(x + p * 2, y + p * 9, p * 12, p * 2.4, '#D6A536')
    this.pixelRect(x + p * 4, y + p * 6, p * 8, p * 4, '#E8C547')
    this.pixelRect(x + p * 5, y + p * 8, p * 6, p * 1.2, '#5C8A3C')
    this.pixelRect(x + p * 3, y + p * 11, p * 10, p * 1.2, '#B88422')
  }

  private drawCrown(cx: number, cy: number, size: number): void {
    const p = size / 16
    const x = cx - size / 2
    const y = cy - size / 2
    this.pixelRect(x + p * 3, y + p * 9, p * 10, p * 3.2, '#C79218')
    this.pixelRect(x + p * 4, y + p * 6, p * 2.4, p * 4, '#F7D14A')
    this.pixelRect(x + p * 7, y + p * 4, p * 2.4, p * 6, '#F7D14A')
    this.pixelRect(x + p * 10, y + p * 6, p * 2.4, p * 4, '#F7D14A')
    this.pixelRect(x + p * 4.5, y + p * 9.8, p * 1.4, p * 1.4, '#69D2E7')
    this.pixelRect(x + p * 7.3, y + p * 9.8, p * 1.4, p * 1.4, '#E84A5F')
    this.pixelRect(x + p * 10.1, y + p * 9.8, p * 1.4, p * 1.4, '#69D2E7')
  }

  private drawPixelGlasses(cx: number, cy: number, size: number): void {
    const p = size / 16
    const x = cx - size / 2
    const y = cy - size / 2
    this.pixelRect(x + p * 1.5, y + p * 6, p * 5, p * 4, '#111827')
    this.pixelRect(x + p * 9.5, y + p * 6, p * 5, p * 4, '#111827')
    this.pixelRect(x + p * 6.5, y + p * 7.4, p * 3, p * 1.2, '#111827')
    this.pixelRect(x + p * 2.5, y + p * 7, p * 3, p * 1.2, '#4DD0E1')
    this.pixelRect(x + p * 10.5, y + p * 7, p * 3, p * 1.2, '#4DD0E1')
  }

  private drawHeartGlasses(cx: number, cy: number, size: number): void {
    const p = size / 16
    const x = cx - size / 2
    const y = cy - size / 2
    this.drawPixelHeart(x + p * 4, y + p * 8, p * 3.8, '#E84A5F')
    this.drawPixelHeart(x + p * 12, y + p * 8, p * 3.8, '#E84A5F')
    this.pixelRect(x + p * 7.2, y + p * 7.5, p * 1.6, p * 1, '#7A2633')
  }

  private drawDirtBlock(cx: number, cy: number, size: number): void {
    const p = size / 16
    const x = cx - size / 2
    const y = cy - size / 2
    this.pixelRect(x + p * 2, y + p * 2, p * 12, p * 12, '#8B5A2B')
    this.pixelRect(x + p * 2, y + p * 2, p * 12, p * 4, '#5C8A3C')
    this.pixelRect(x + p * 4, y + p * 7, p * 2, p * 2, '#6B4226')
    this.pixelRect(x + p * 9, y + p * 9, p * 3, p * 2, '#A06A36')
    this.pixelRect(x + p * 3, y + p * 3, p * 2, p * 1, '#7BC45E')
    this.pixelRect(x + p * 8, y + p * 4, p * 4, p * 1, '#7BC45E')
  }

  private drawDiamondBlock(cx: number, cy: number, size: number): void {
    const p = size / 16
    const x = cx - size / 2
    const y = cy - size / 2
    this.pixelRect(x + p * 2, y + p * 2, p * 12, p * 12, '#38BDF8')
    this.pixelRect(x + p * 3, y + p * 3, p * 10, p * 3, '#A5F3FC')
    this.pixelRect(x + p * 3, y + p * 7, p * 4, p * 5, '#67E8F9')
    this.pixelRect(x + p * 8, y + p * 7, p * 5, p * 5, '#0891B2')
    this.pixelRect(x + p * 5, y + p * 5, p * 2, p * 2, '#FFFFFF')
  }

  private drawVfx(anchor: BBox, itemId: string, size: number): void {
    if (itemId === 'vfx-rainbow') {
      this.drawRainbowAura(anchor, size)
      return
    }
    this.drawSparkles(anchor, size)
  }

  private drawSparkles([x, y, w, h]: BBox, size: number): void {
    const points = [
      [0.22, 0.12, 1],
      [0.72, 0.18, 0.75],
      [0.14, 0.56, 0.65],
      [0.84, 0.62, 0.68],
      [0.48, 0.04, 0.55],
      [0.58, 0.78, 0.58],
    ]
    this.ctx.save()
    this.ctx.globalAlpha = 0.9
    for (const [px, py, scale] of points) {
      this.drawPixelStar(x + w * px, y + h * py, size * 0.09 * scale, '#F9E66B')
    }
    this.ctx.restore()
  }

  private drawRainbowAura([x, y, w, h]: BBox, size: number): void {
    this.ctx.save()
    this.ctx.globalAlpha = 0.74
    const colors = ['#E84A5F', '#F9A03F', '#F9E66B', '#4CAF50', '#4DD0E1', '#A855F7']
    const block = Math.max(5, Math.round(size / 44))
    colors.forEach((color, index) => {
      const inset = index * block * 1.7
      const left = x + w * 0.12 + inset
      const right = x + w * 0.88 - inset
      const top = y + h * 0.08 + index * block * 1.3
      const steps = 18 - index

      for (let step = 0; step <= steps; step += 1) {
        const t = step / steps
        const px = left + (right - left) * t
        const arc = Math.sin(Math.PI * t)
        const py = top + h * 0.34 * (1 - arc)
        this.pixelRect(px, py, block * 1.4, block * 1.4, color)
      }
    })
    this.ctx.restore()
  }

  private drawPixelHeart(cx: number, cy: number, size: number, color: string): void {
    const p = size / 5
    this.pixelRect(cx - p * 2, cy - p * 2, p * 2, p * 2, color)
    this.pixelRect(cx + p * 0, cy - p * 2, p * 2, p * 2, color)
    this.pixelRect(cx - p * 2, cy, p * 4, p * 2, color)
    this.pixelRect(cx - p, cy + p * 2, p * 2, p * 1.5, color)
  }

  private drawPixelStar(cx: number, cy: number, size: number, color: string): void {
    this.pixelRect(cx - size * 0.2, cy - size, size * 0.4, size * 2, color)
    this.pixelRect(cx - size, cy - size * 0.2, size * 2, size * 0.4, color)
    this.pixelRect(cx - size * 0.45, cy - size * 0.45, size * 0.9, size * 0.9, '#FFFFFF')
  }

  private pixelRect(x: number, y: number, width: number, height: number, color: string): void {
    this.ctx.fillStyle = color
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(width)), Math.max(1, Math.round(height)))
  }

  private roundRect(x: number, y: number, width: number, height: number, radius: number): void {
    this.ctx.beginPath()
    this.ctx.roundRect(x, y, width, height, radius)
  }

  private constrainBbox([x, y, w, h]: BBox): BBox {
    const canvasW = this.getCanvasCssWidth()
    const canvasH = this.getCanvasCssHeight()
    const width = this.clamp(w, 72, canvasW * 0.98)
    const height = this.clamp(h, 72, canvasH * 0.88)
    return [
      this.clamp(x, -width * 0.12, canvasW - width * 0.88),
      this.clamp(y, 64, canvasH - height * 0.72),
      width,
      height,
    ]
  }

  private emitState(force = false): void {
    if (!this.onStateChange) return
    const state = this.getState()
    const key = [
      state.locked,
      state.detected,
      state.source,
      state.anchor?.map((value) => Math.round(value / 4)).join(',') ?? 'none',
    ].join('|')

    if (force || key !== this.lastStateKey) {
      this.lastStateKey = key
      this.onStateChange(state)
    }
  }

  private hasFreshDetection(): boolean {
    return this.lastDetectionHitAt > 0 && performance.now() - this.lastDetectionHitAt <= this.detectionFreshMs
  }

  private getCanvasCssWidth(): number {
    return this.canvas.clientWidth || this.canvas.width || window.innerWidth
  }

  private getCanvasCssHeight(): number {
    return this.canvas.clientHeight || this.canvas.height || window.innerHeight
  }

  private copyBbox(bbox: BBox): BBox {
    return [...bbox] as BBox
  }

  private deadzoneLerp(a: number, b: number, t: number): number {
    if (Math.abs(a - b) < 1.5) return a
    return a + (b - a) * t
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
  }
}
