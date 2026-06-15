import { BottomNav } from '@/components/bottom-nav'
import { AppHeader } from '@/components/app-header'
import { FriendPlantSync } from '@/components/friend-plant-sync'
import { TournamentBubble } from '@/components/tournament-bubble'

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="plantcraft-shell flex min-h-screen flex-col">
      <AppHeader />
      <FriendPlantSync />
      <BottomNav />
      <main className="app-main animate-fade-in flex-1 pb-20 lg:pb-0">
        {children}
      </main>
      <TournamentBubble />
    </div>
  )
}
