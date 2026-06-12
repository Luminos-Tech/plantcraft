'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Camera, ClipboardList, Leaf, QrCode, Store } from 'lucide-react'
import { cn } from '@/lib/utils'
import { APP_VERSION } from '@/lib/version'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Garden', icon: <Leaf className="h-5 w-5" /> },
  { href: '/shop', label: 'Shop', icon: <Store className="h-5 w-5" /> },
  { href: '/camera', label: 'Camera', icon: <Camera className="h-5 w-5" /> },
  { href: '/mission', label: 'Mission', icon: <ClipboardList className="h-5 w-5" /> },
  { href: '/scan-friend', label: 'Scan', icon: <QrCode className="h-5 w-5" /> },
]

export function BottomNav() {
  const pathname = usePathname()
  const cameraItem = navItems.find((item) => item.href === '/camera')!
  const sideItems = navItems.filter((item) => item.href !== '/camera')
  const isCameraActive = pathname.startsWith('/camera')

  return (
    <nav className="stable-bottom-nav fixed bottom-0 left-0 right-0 z-50 border-t border-primary/20 bg-card/92 shadow-[0_-10px_30px_rgba(30,47,37,0.12)] backdrop-blur-xl lg:sticky lg:bottom-auto lg:top-[57px] lg:border-b lg:border-t-0 lg:shadow-sm">
      <div className="mx-auto grid h-[4.6rem] max-w-[1180px] grid-cols-[1fr_1fr_5rem_1fr_1fr] items-center gap-1 px-2 lg:flex lg:h-14 lg:justify-center lg:gap-3">
        {sideItems.slice(0, 2).map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group relative flex min-w-0 flex-col items-center gap-1 rounded-md px-2 py-2 transition-all lg:min-w-28 lg:flex-row lg:justify-center lg:gap-2 lg:px-4',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Active top indicator */}
              {isActive && (
                <span className="absolute left-1/2 top-0 h-[2px] w-8 -translate-x-1/2 rounded-full bg-primary lg:hidden" />
              )}
              <span className={cn(
                'transition-transform',
                isActive && 'scale-110'
              )}>
                {item.icon}
              </span>
              <span className={cn(
                'truncate font-pixel text-[9px]',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}>
                {item.label}
              </span>
            </Link>
          )
        })}

        <Link
          href={cameraItem.href}
          className={cn(
            'camera-nav-button group relative mx-auto -mt-8 flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-full border-[3px] border-card bg-primary text-primary-foreground shadow-[0_12px_28px_rgba(47,143,91,0.3)] transition-all hover:bg-primary/90 lg:mt-0 lg:h-10 lg:w-auto lg:min-w-32 lg:flex-row lg:rounded-md lg:border lg:border-primary lg:px-4 lg:shadow-none',
            isCameraActive && 'bg-accent text-accent-foreground shadow-[0_12px_28px_rgba(246,195,91,0.32)] lg:border-accent'
          )}
          aria-current={isCameraActive ? 'page' : undefined}
        >
          <span className={cn('transition-transform', isCameraActive && 'scale-110')}>
            {cameraItem.icon}
          </span>
          <span className="font-pixel text-[7px] lg:text-[9px]">{cameraItem.label}</span>
        </Link>

        {sideItems.slice(2).map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group relative flex min-w-0 flex-col items-center gap-1 rounded-md px-1.5 py-2 transition-all lg:min-w-28 lg:flex-row lg:justify-center lg:gap-2 lg:px-4',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <span className="absolute left-1/2 top-0 h-[2px] w-8 -translate-x-1/2 rounded-full bg-primary lg:hidden" />
              )}
              <span className={cn(
                'transition-transform',
                isActive && 'scale-110'
              )}>
                {item.icon}
              </span>
              <span className={cn(
                'truncate font-pixel text-[9px]',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
      <div className="hidden pb-1 text-center font-pixel text-[6px] text-muted-foreground/60 lg:block">
        v{APP_VERSION}
      </div>
    </nav>
  )
}
