'use client'

import { AlertTriangle, CheckCircle2, HeartPulse, ShieldAlert, Sparkles, X } from 'lucide-react'
import { DiagnosisResult } from '@/lib/store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface ScanResultModalProps {
  result: DiagnosisResult | null
  plantId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ScanResultModal({ result, plantId, open, onOpenChange }: ScanResultModalProps) {
  if (!result) return null

  const getSeverityClass = (severity: string) => {
    switch (severity) {
      case 'mild': return 'border-[#F6C35B]/40 bg-[#F6C35B]/15 text-[#8A5A00]'
      case 'moderate': return 'border-[#F59E0B]/40 bg-[#F59E0B]/15 text-[#9A4A00]'
      case 'severe': return 'border-destructive/35 bg-destructive/12 text-destructive'
      default: return 'border-border bg-muted text-muted-foreground'
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

  const confidence = Math.max(0, Math.min(100, Math.round(result.confidence * 100)))
  const isHealthy = result.isHealthy

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        style={{ zIndex: 10060 }}
        className={cn(
          'w-[min(94vw,430px)] overflow-hidden rounded-xl border-2 bg-card p-0 shadow-2xl',
          isHealthy ? 'border-primary/65' : 'border-destructive/65'
        )}
      >
        <DialogTitle className="sr-only">
          {isHealthy ? 'Plant scan clear' : 'Plant care alert'}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {isHealthy
            ? 'The scan did not detect an urgent plant issue.'
            : 'The scan found a plant care issue and shows treatment steps.'}
        </DialogDescription>

        <div
          className={cn(
            'relative px-4 pb-4 pt-5 text-center',
            isHealthy
              ? 'bg-[linear-gradient(180deg,rgba(47,143,91,0.18),rgba(255,255,255,0))]'
              : 'bg-[linear-gradient(180deg,rgba(231,76,60,0.16),rgba(255,255,255,0))]'
          )}
        >
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card/80 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Close scan result"
          >
            <X className="h-4 w-4" />
          </button>

          <div
            className={cn(
              'mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 shadow-sm',
              isHealthy
                ? 'border-primary/35 bg-primary/12 text-primary'
                : 'border-destructive/35 bg-destructive/12 text-destructive'
            )}
          >
            {isHealthy ? (
              <CheckCircle2 className="h-8 w-8" />
            ) : (
              <ShieldAlert className="h-8 w-8" />
            )}
          </div>

          <div className="mt-3 font-pixel text-sm text-foreground">
            {isHealthy ? 'Plant Scan Clear' : 'Care Alert'}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {isHealthy ? 'No urgent issue detected.' : 'Review the diagnosis and treatment steps.'}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-border bg-card/80 px-3 py-2">
              <div className="font-pixel text-[7px] text-muted-foreground">Confidence</div>
              <div className="mt-1 flex items-center justify-center gap-1.5 font-pixel text-base text-foreground">
                <HeartPulse className={cn('h-4 w-4', isHealthy ? 'text-primary' : 'text-destructive')} />
                {confidence}%
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card/80 px-3 py-2">
              <div className="font-pixel text-[7px] text-muted-foreground">Severity</div>
              <div className={cn(
                'mt-1 inline-flex min-h-7 items-center rounded-md border px-2 font-pixel text-[8px]',
                isHealthy ? 'border-primary/35 bg-primary/10 text-primary' : getSeverityClass(result.severity)
              )}>
                {isHealthy ? 'Healthy' : getSeverityLabel(result.severity)}
              </div>
            </div>
          </div>
        </div>

        <div className="max-h-[42vh] overflow-y-auto px-4 py-4">
          <section className="rounded-lg border border-border bg-secondary/45 p-3">
            <div className="flex items-start gap-2">
              {isHealthy ? (
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              )}
              <div className="min-w-0">
                <div className="break-words font-pixel text-[10px] leading-relaxed text-foreground">
                  {result.disease}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {isHealthy
                    ? 'Keep the same care rhythm and scan again later if the leaves change.'
                    : 'Follow the steps below and scan again after treatment.'}
                </p>
              </div>
            </div>
          </section>

          {result.treatments && result.treatments.length > 0 && (
            <section className="mt-3">
              <div className="mb-2 flex items-center gap-1.5 font-pixel text-[8px] text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                Treatment Steps
              </div>
              <ol className="grid gap-2">
                {result.treatments.map((step, index) => (
                  <li key={`${step}-${index}`} className="flex gap-2 rounded-md border border-border bg-card/80 p-2 text-xs leading-relaxed text-foreground">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-accent/20 font-pixel text-[8px] text-accent">
                      {index + 1}
                    </span>
                    <span className="min-w-0 break-words">{step}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        <div className="grid gap-2 border-t border-border bg-card/95 p-4">
          <Button
            onClick={() => onOpenChange(false)}
            variant={isHealthy ? 'default' : 'outline'}
            className={cn(
              'h-11 rounded-md font-pixel text-[9px]',
              isHealthy
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'border-2 border-primary bg-card'
            )}
          >
            {isHealthy ? 'Done' : 'Review Later'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
