'use client'

import { Plus, Sprout } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyGardenProps {
  onAddPlant: () => void
}

// Pixel art empty pot SVG
const EmptyPotIcon = () => (
  <svg width="96" height="96" viewBox="0 0 32 32" fill="none" className="mx-auto">
    {/* Pot body */}
    <rect x="6" y="16" width="20" height="12" fill="#8B7355" />
    <rect x="8" y="28" width="16" height="2" fill="#6B5344" />
    <rect x="4" y="14" width="24" height="2" fill="#A08060" />
    
    {/* Pot rim highlight */}
    <rect x="6" y="14" width="20" height="1" fill="#B89070" />
    
    {/* Soil */}
    <rect x="8" y="16" width="16" height="3" fill="#4A3728" />
    
    {/* Tiny sprout */}
    <rect x="15" y="12" width="2" height="4" fill="#5C8A3C" />
    <rect x="13" y="10" width="2" height="2" fill="#6B9B4B" />
    <rect x="17" y="10" width="2" height="2" fill="#6B9B4B" />
    
    {/* Sparkles */}
    <rect x="10" y="6" width="2" height="2" fill="#E8C547" opacity="0.8">
      <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2s" repeatCount="indefinite" />
    </rect>
    <rect x="22" y="8" width="2" height="2" fill="#E8C547" opacity="0.6">
      <animate attributeName="opacity" values="0.6;0.2;0.6" dur="2.5s" repeatCount="indefinite" />
    </rect>
    <rect x="6" y="10" width="2" height="2" fill="#E8C547" opacity="0.4">
      <animate attributeName="opacity" values="0.4;0.1;0.4" dur="3s" repeatCount="indefinite" />
    </rect>
  </svg>
)

export function EmptyGarden({ onAddPlant }: EmptyGardenProps) {
  return (
    <div className="surface-panel flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="rounded-full bg-secondary p-4 ring-1 ring-border">
        <EmptyPotIcon />
      </div>
      
      <h2 className="mt-5 flex items-center gap-2 font-pixel text-sm text-foreground">
        <Sprout className="h-4 w-4 text-primary" />
        Garden is empty
      </h2>
      
      <p className="mt-2 max-w-xs text-sm text-muted-foreground leading-relaxed">
        Ready for a first sprout.
      </p>
      
      <Button
        onClick={onAddPlant}
        className="soft-button mt-5 rounded-md bg-primary px-6 font-pixel text-xs text-primary-foreground hover:bg-primary/90"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add First Plant
      </Button>
    </div>
  )
}
