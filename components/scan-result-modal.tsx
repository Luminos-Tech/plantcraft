'use client'

import { DiagnosisResult, useGameStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface ScanResultModalProps {
  result: DiagnosisResult | null
  plantId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ScanResultModal({ result, plantId, open, onOpenChange }: ScanResultModalProps) {
  const { curePlant } = useGameStore()

  if (!result) return null

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'mild': return 'text-yellow-600 bg-yellow-100'
      case 'moderate': return 'text-orange-600 bg-orange-100'
      case 'severe': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'mild': return 'Mild'
      case 'moderate': return 'Moderate'
      case 'severe': return 'Severe'
      default: return severity
    }
  }

  const handleCure = () => {
    if (plantId) {
      curePlant(plantId)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-sm border-2 border-primary bg-card">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <span className="text-4xl">
              {result.isHealthy ? '✅' : '⚠️'}
            </span>
          </div>
          <DialogTitle className="font-pixel text-sm text-primary">
            {result.isHealthy ? 'Healthy Plant!' : 'Disease Detected'}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Confidence: {Math.round(result.confidence * 100)}%
          </DialogDescription>
        </DialogHeader>

        {/* Disease Info */}
        <div className="mt-4 rounded-sm border border-border bg-secondary/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-pixel text-[10px] text-foreground">
              🌿 {result.disease}
            </h3>
            {!result.isHealthy && (
              <span className={`rounded-sm px-2 py-0.5 font-pixel text-[8px] ${getSeverityColor(result.severity)}`}>
                {getSeverityLabel(result.severity)}
              </span>
            )}
          </div>

          {/* Treatments */}
          {result.treatments && result.treatments.length > 0 && (
            <div className="mt-3">
              <h4 className="font-pixel text-[8px] text-muted-foreground mb-2">
                💊 Treatment Steps:
              </h4>
              <ol className="space-y-1.5">
                {result.treatments.map((step, i) => (
                  <li key={i} className="flex gap-2 text-xs text-foreground">
                    <span className="flex-shrink-0 font-pixel text-[8px] text-accent">
                      {i + 1}.
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex gap-2">
          {!result.isHealthy && plantId && (
            <Button
              onClick={handleCure}
              className="flex-1 rounded-sm bg-accent font-pixel text-[10px] text-accent-foreground hover:bg-accent/90"
            >
              ✨ Cured (+100 GC)
            </Button>
          )}
          <Button
            onClick={() => onOpenChange(false)}
            variant={result.isHealthy ? 'default' : 'outline'}
            className={`${result.isHealthy ? 'flex-1' : ''} rounded-sm font-pixel text-[10px] ${
              result.isHealthy
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'border-2 border-primary'
            }`}
          >
            {result.isHealthy ? '🎉 Awesome!' : 'Close'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
