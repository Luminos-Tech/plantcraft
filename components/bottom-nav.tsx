'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { APP_VERSION } from '@/lib/version'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
}

// Pixel art style icons as simple SVGs
const GardenIcon = () => (
  <svg width="24" height="24" viewBox="0 0 16 16" fill="currentColor" className="pixel-icon">
    <rect x="7" y="0" width="2" height="4" />
    <rect x="5" y="2" width="2" height="2" />
    <rect x="9" y="2" width="2" height="2" />
    <rect x="3" y="4" width="2" height="2" />
    <rect x="11" y="4" width="2" height="2" />
    <rect x="7" y="4" width="2" height="4" />
    <rect x="5" y="8" width="6" height="2" />
    <rect x="4" y="10" width="8" height="2" />
    <rect x="3" y="12" width="10" height="4" />
  </svg>
)

const ShopIcon = () => (
  <svg width="24" height="24" viewBox="0 0 16 16" fill="currentColor" className="pixel-icon">
    <rect x="2" y="0" width="12" height="2" />
    <rect x="1" y="2" width="2" height="4" />
    <rect x="13" y="2" width="2" height="4" />
    <rect x="3" y="2" width="10" height="2" />
    <rect x="2" y="6" width="12" height="2" />
    <rect x="2" y="8" width="12" height="8" />
    <rect x="6" y="10" width="4" height="4" fill="var(--background)" />
  </svg>
)

const CameraIcon = () => (
  <svg width="24" height="24" viewBox="0 0 16 16" fill="currentColor" className="pixel-icon">
    <rect x="5" y="0" width="6" height="2" />
    <rect x="1" y="2" width="14" height="2" />
    <rect x="0" y="4" width="16" height="10" />
    <rect x="5" y="6" width="6" height="6" fill="var(--background)" />
    <rect x="6" y="7" width="4" height="4" fill="currentColor" />
    <rect x="12" y="5" width="2" height="2" fill="var(--accent)" />
  </svg>
)

const ScanIcon = () => (
  <svg width="24" height="24" viewBox="0 0 16 16" fill="currentColor" className="pixel-icon">
    <rect x="0" y="0" width="4" height="2" />
    <rect x="0" y="0" width="2" height="4" />
    <rect x="12" y="0" width="4" height="2" />
    <rect x="14" y="0" width="2" height="4" />
    <rect x="0" y="14" width="4" height="2" />
    <rect x="0" y="12" width="2" height="4" />
    <rect x="12" y="14" width="4" height="2" />
    <rect x="14" y="12" width="2" height="4" />
    <rect x="4" y="7" width="8" height="2" />
  </svg>
)

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Garden', icon: <GardenIcon /> },
  { href: '/shop', label: 'Shop', icon: <ShopIcon /> },
  { href: '/camera', label: 'Camera', icon: <CameraIcon /> },
  { href: '/scan-friend', label: 'Scan', icon: <ScanIcon /> },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t-2 border-primary bg-card">
      <div className="flex h-16 items-center justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 px-4 py-2 transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span className={cn(
                'transition-transform',
                isActive && 'scale-110'
              )}>
                {item.icon}
              </span>
              <span className={cn(
                'font-pixel text-[8px]',
                isActive && 'text-primary'
              )}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
      <div className="pb-1 text-center font-pixel text-[6px] text-muted-foreground/50">
        v{APP_VERSION}
      </div>
    </nav>
  )
}
