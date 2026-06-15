'use client'

import { useMemo, useState } from 'react'
import { Award, CheckCircle2, HeartPulse, Info, Palette, Sparkles, Trophy } from 'lucide-react'
import {
  getFriendOwnerName,
  getMonthKey,
  getPlantGroupConfig,
  useGameStore,
} from '@/lib/store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type TournamentTab = 'style' | 'care'

interface Candidate {
  id: string
  name: string
  description: string
  ownerLabel: string
  imageUrl?: string
  plantGroupLabel: string
  hp: number
  decorations: number
  votes: number
}

function daysUntilMonthEnd(now = new Date()) {
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return Math.max(1, end.getDate() - now.getDate() + 1)
}

const TAB_COPY: Record<TournamentTab, { title: string; description: string }> = {
  style: {
    title: 'Best style',
    description: 'Vote for the plant with the most delightful AR decorations, composition, and visual personality.',
  },
  care: {
    title: 'Best care',
    description: 'Vote for the plant that looks consistently healthy, loved, and well maintained this month.',
  },
}

export function TournamentBubble() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<TournamentTab>('style')
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  const {
    plants,
    userProfile,
    tournamentVotes,
    tournamentRewardClaims,
    getPlantHp,
    castTournamentVote,
    claimTournamentReward,
  } = useGameStore()
  const monthKey = getMonthKey()
  const rewardItemId = 'vfx-victory-aurora'
  const claimKey = `${monthKey}:${rewardItemId}`
  const rewardClaimed = (tournamentRewardClaims ?? []).includes(claimKey)

  const candidates = useMemo<Candidate[]>(() => {
    const votesForTab = tournamentVotes?.filter((vote) => vote.monthKey === monthKey && vote.category === tab) ?? []
    const countVotes = (candidateId: string) => votesForTab.filter((vote) => vote.candidateId === candidateId).length

    const mine = plants.map((plant) => {
      const hp = getPlantHp(plant.id)
      const id = `mine:${plant.id}`
      return {
        id,
        name: plant.name,
        description: plant.description,
        ownerLabel: 'My Garden',
        imageUrl: plant.imageUrl,
        plantGroupLabel: getPlantGroupConfig(plant.plantGroup).label,
        hp,
        decorations: plant.placedItems?.length ?? 0,
        votes: countVotes(id),
      }
    })

    const seenFriends = new Set<string>()
    const friends = (userProfile?.dailyNeighbors ?? []).flatMap((friend) => {
      const key = `${friend.ownerUid}:${friend.plantId}`
      if (seenFriends.has(key)) return []
      seenFriends.add(key)
      const id = `friend:${key}`
      return [{
        id,
        name: friend.name,
        description: friend.description,
        ownerLabel: getFriendOwnerName(friend.ownerUid),
        imageUrl: friend.imageUrl,
        plantGroupLabel: getPlantGroupConfig(friend.plantGroup).label,
        hp: friend.hp,
        decorations: friend.placedItems?.length ?? 0,
        votes: countVotes(id),
      }]
    })

    return [...mine, ...friends]
      .sort((a, b) => b.votes - a.votes || b.hp - a.hp || b.decorations - a.decorations)
      .slice(0, 8)
  }, [getPlantHp, monthKey, plants, tab, tournamentVotes, userProfile?.dailyNeighbors])

  const currentVote = (tournamentVotes ?? []).find((vote) => (
    vote.monthKey === monthKey && vote.category === tab
  ))
  const voteComplete = ['style', 'care'].every((category) => (
    tournamentVotes?.some((vote) => vote.monthKey === monthKey && vote.category === category)
  ))
  const selectedCandidate = candidates.find((candidate) => candidate.id === selectedCandidateId) ?? null
  const selectedCandidateRank = selectedCandidate
    ? candidates.findIndex((candidate) => candidate.id === selectedCandidate.id) + 1
    : null
  const activeCopy = TAB_COPY[tab]

  const castVote = (candidateId: string) => {
    castTournamentVote(monthKey, tab, candidateId)
    setSelectedCandidateId(candidateId)
  }

  return (
    <>
      <button
        type="button"
        className="tournament-bubble"
        onClick={() => setOpen(true)}
        aria-label="Open monthly tournament"
        title="Monthly tournament"
      >
        <Trophy className="h-5 w-5" aria-hidden="true" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[86vh] w-[min(94vw,520px)] overflow-hidden rounded-lg border-2 border-accent bg-card p-0">
          <DialogTitle className="sr-only">Monthly Plant Tournament</DialogTitle>
          <DialogDescription className="sr-only">
            Vote for the best decorated and best cared plants this month.
          </DialogDescription>

          <div className="border-b border-border bg-[linear-gradient(180deg,rgba(246,195,91,0.18),rgba(255,255,255,0))] px-4 pb-3 pt-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md border border-accent/45 bg-accent/20 text-accent">
                <Trophy className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="font-pixel text-sm text-foreground">Monthly Tournament</div>
                <p className="mt-1 text-xs text-muted-foreground">{daysUntilMonthEnd()} days left • Victory Aurora AR reward</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTab('style')}
                className={cn('tournament-tab', tab === 'style' && 'is-active')}
              >
                <Palette className="h-4 w-4" aria-hidden="true" />
                Best style
              </button>
              <button
                type="button"
                onClick={() => setTab('care')}
                className={cn('tournament-tab', tab === 'care' && 'is-active')}
              >
                <HeartPulse className="h-4 w-4" aria-hidden="true" />
                Best care
              </button>
            </div>
          </div>

          <div className="max-h-[46vh] overflow-y-auto px-4 py-3">
            <div className="mb-3 rounded-md border border-primary/20 bg-secondary/45 px-3 py-2">
              <div className="flex items-center gap-2 font-pixel text-[8px] text-primary">
                <Info className="h-3.5 w-3.5" aria-hidden="true" />
                {activeCopy.title}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{activeCopy.description}</p>
            </div>

            {selectedCandidate && (
              <div className="mb-3 rounded-md border border-accent/30 bg-accent/10 p-3">
                <div className="flex items-center gap-3">
                  <span className="tournament-candidate-avatar">
                    <img src={selectedCandidate.imageUrl || '/placeholder-logo.png'} alt="" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-pixel text-[10px] text-foreground">{selectedCandidate.name}</span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">{selectedCandidate.ownerLabel}</span>
                  </span>
                  {selectedCandidateRank && (
                    <span className="tournament-rank font-pixel">#{selectedCandidateRank}</span>
                  )}
                </div>
                {selectedCandidate.description && (
                  <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {selectedCandidate.description}
                  </p>
                )}
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md border border-border bg-card/70 px-2 py-1.5">
                    <div className="font-pixel text-[9px] text-primary">{selectedCandidate.votes}</div>
                    <div className="font-pixel text-[6px] text-muted-foreground">votes</div>
                  </div>
                  <div className="rounded-md border border-border bg-card/70 px-2 py-1.5">
                    <div className="font-pixel text-[9px] text-primary">{selectedCandidate.decorations}</div>
                    <div className="font-pixel text-[6px] text-muted-foreground">items</div>
                  </div>
                  <div className="rounded-md border border-border bg-card/70 px-2 py-1.5">
                    <div className="truncate font-pixel text-[9px] text-primary">{selectedCandidate.plantGroupLabel}</div>
                    <div className="font-pixel text-[6px] text-muted-foreground">group</div>
                  </div>
                </div>
                <Button
                  onClick={() => castVote(selectedCandidate.id)}
                  className="mt-3 h-9 w-full rounded-md bg-primary font-pixel text-[8px] text-primary-foreground hover:bg-primary/90"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Vote this plant
                </Button>
              </div>
            )}

            {candidates.length === 0 ? (
              <div className="rounded-md border border-border bg-secondary/45 p-4 text-center">
                <Award className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden="true" />
                <p className="mt-2 font-pixel text-[9px] text-muted-foreground">No candidates yet</p>
              </div>
            ) : (
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-pixel text-[8px] text-foreground">Current ranking</span>
                  <span className="font-pixel text-[6px] text-muted-foreground">tap plant for details</span>
                </div>
                <div className="grid gap-2">
                  {candidates.map((candidate, index) => {
                    const selected = currentVote?.candidateId === candidate.id
                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => setSelectedCandidateId(candidate.id)}
                        className={cn('tournament-candidate', selected && 'is-selected')}
                      >
                        <span className="tournament-rank font-pixel">#{index + 1}</span>
                        <span className="tournament-candidate-avatar">
                          <img src={candidate.imageUrl || '/placeholder-logo.png'} alt="" />
                        </span>
                        <span className="min-w-0 flex-1 text-left">
                          <span className="block truncate font-pixel text-[9px] text-foreground">{candidate.name}</span>
                          <span className="mt-1 block truncate text-xs text-muted-foreground">{candidate.ownerLabel}</span>
                        </span>
                        <span className="min-w-12 text-right">
                          <span className="block font-pixel text-[9px] text-accent">{candidate.votes}</span>
                          <span className="block font-pixel text-[6px] text-muted-foreground">votes</span>
                        </span>
                        {selected && <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border bg-card/95 p-4">
            <div className="mb-3 rounded-md border border-accent/30 bg-accent/10 px-3 py-2">
              <div className="flex items-center gap-2 font-pixel text-[8px] text-accent">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Victory Aurora
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Winner unlocks a golden aurora orbit with emerald ribbons and starbursts around the plant.</p>
            </div>
            <Button
              onClick={() => claimTournamentReward(monthKey)}
              disabled={!voteComplete || rewardClaimed}
              className="h-11 w-full rounded-md bg-accent font-pixel text-[9px] text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
            >
              <Trophy className="h-4 w-4" aria-hidden="true" />
              {rewardClaimed ? 'Reward claimed' : voteComplete ? 'Claim effect' : 'Vote both tabs'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
