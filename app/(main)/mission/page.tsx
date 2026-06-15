'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Coins,
  Droplets,
  Leaf,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Trophy,
} from 'lucide-react'
import { CARE_ACTION_COOLDOWN_MS, getWaterCycleRemainingMs, useGameStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

const DAY_MS = 24 * 60 * 60 * 1000

type MissionTone = 'daily' | 'clean' | 'scan' | 'emergency'

interface MissionTask {
  id: string
  periodKey: string
  kicker: string
  title: string
  meta: string
  icon: ReactNode
  tone: MissionTone
  progress: number
  target: number
  reward: number
  deadlineAt: number
  claimed: boolean
  available: boolean
  href?: string
  actionLabel?: string
  guideSteps?: string[]
  checklist?: {
    id: string
    label: string
    done: boolean
  }[]
}

function getDayWindow(now: number) {
  const startDate = new Date(now)
  startDate.setHours(0, 0, 0, 0)
  const start = startDate.getTime()
  const end = start + DAY_MS
  const year = startDate.getFullYear()
  const month = String(startDate.getMonth() + 1).padStart(2, '0')
  const day = String(startDate.getDate()).padStart(2, '0')

  return {
    start,
    end,
    key: `${year}-${month}-${day}`,
  }
}

function formatTimeLeft(deadlineAt: number, now: number) {
  const ms = Math.max(0, deadlineAt - now)
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)

  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`
  return '<1m'
}

function getToneClasses(tone: MissionTone) {
  switch (tone) {
    case 'emergency':
      return {
        card: 'border-destructive/50 bg-[linear-gradient(135deg,rgba(231,76,60,0.12),rgba(255,255,255,0.82))]',
        icon: 'bg-destructive text-destructive-foreground',
        progress: 'bg-destructive',
      }
    case 'clean':
      return {
        card: 'border-primary/25 bg-[linear-gradient(135deg,rgba(223,243,231,0.9),rgba(255,255,255,0.82))]',
        icon: 'bg-primary text-primary-foreground',
        progress: 'bg-primary',
      }
    case 'scan':
      return {
        card: 'border-[#6BA6FF]/40 bg-[linear-gradient(135deg,rgba(107,166,255,0.12),rgba(255,255,255,0.86))]',
        icon: 'bg-[#6BA6FF] text-white',
        progress: 'bg-[#6BA6FF]',
      }
    default:
      return {
        card: 'border-accent/40 bg-[linear-gradient(135deg,rgba(246,195,91,0.14),rgba(255,255,255,0.86))]',
        icon: 'bg-accent text-accent-foreground',
        progress: 'bg-accent',
      }
  }
}

function MissionCard({
  task,
  now,
  onClaim,
}: {
  task: MissionTask
  now: number
  onClaim: (task: MissionTask) => void
}) {
  const classes = getToneClasses(task.tone)
  const completed = task.progress >= task.target
  const canClaim = completed && !task.claimed
  const progressValue = Math.min(100, Math.round((task.progress / task.target) * 100))

  return (
    <article className={cn('surface-panel overflow-hidden border-2 p-3 sm:p-4', classes.card)}>
      <div className="flex items-start gap-3">
        <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-md shadow-sm', classes.icon)}>
          {task.icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="font-pixel text-[7px] text-muted-foreground">{task.kicker}</span>
              <h3 className="mt-1 truncate font-pixel text-[10px] text-foreground sm:text-xs">
                {task.title}
              </h3>
            </div>
            <span
              className={cn(
                'shrink-0 rounded-full px-2 py-1 font-pixel text-[6px]',
                task.claimed
                  ? 'bg-primary text-primary-foreground'
                  : completed
                    ? 'bg-accent text-accent-foreground'
                    : task.available
                      ? 'bg-secondary text-primary'
                      : 'bg-muted text-muted-foreground'
              )}
            >
              {task.claimed ? 'CLAIMED' : completed ? 'READY' : task.available ? `${task.progress}/${task.target}` : 'STANDBY'}
            </span>
          </div>

          <p className="mt-2 text-sm text-muted-foreground">{task.meta}</p>

          <div className="mt-3">
            <Progress
              value={progressValue}
              className="h-2.5 bg-card/80 ring-1 ring-border/70"
              indicatorClassName={classes.progress}
            />
          </div>

          {task.guideSteps && task.guideSteps.length > 0 && (
            <div className="mt-3 rounded-md border border-border/70 bg-card/70 p-2.5">
              <div className="font-pixel text-[7px] text-muted-foreground">Care guide</div>
              <ol className="mt-2 grid gap-1.5">
                {task.guideSteps.map((step, index) => (
                  <li key={`${step}-${index}`} className="flex gap-2 text-xs leading-relaxed text-foreground">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-accent/20 font-pixel text-[7px] text-accent">
                      {index + 1}
                    </span>
                    <span className="min-w-0 break-words">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {task.checklist && task.checklist.length > 0 && (
            <div className="mt-3 grid gap-1.5">
              {task.checklist.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs',
                    item.done
                      ? 'border-primary/25 bg-primary/10 text-primary'
                      : 'border-border/70 bg-card/70 text-muted-foreground'
                  )}
                >
                  {item.done ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-current" aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1">{item.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-md bg-card/70 px-2 py-1 font-pixel text-[7px]">
            <CalendarClock className="h-3 w-3" aria-hidden="true" />
            {formatTimeLeft(task.deadlineAt, now)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-card/70 px-2 py-1 font-pixel text-[7px] text-accent">
            <Coins className="h-3 w-3" aria-hidden="true" />
            +{task.reward} GC
          </span>
        </div>

        <div className="flex gap-2">
          {!completed && task.href && (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-8 rounded-md border-primary/50 bg-card/85 font-pixel text-[8px]"
            >
              <Link href={task.href}>{task.actionLabel ?? 'Go'}</Link>
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => onClaim(task)}
            disabled={!canClaim}
            className={cn(
              'h-8 rounded-md font-pixel text-[8px]',
              canClaim
                ? 'bg-accent text-accent-foreground hover:bg-accent/90'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {task.claimed ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Done
              </>
            ) : (
              <>
                <Coins className="h-3.5 w-3.5" aria-hidden="true" />
                Claim
              </>
            )}
          </Button>
        </div>
      </div>
    </article>
  )
}

export default function MissionPage() {
  const [now, setNow] = useState(() => Date.now())
  const {
    plants,
    careLogs,
    coins,
    missionClaims = [],
    claimMissionReward,
    completeRescueMission,
    getPlantHp,
  } = useGameStore()

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(interval)
  }, [])

  const dayWindow = useMemo(() => getDayWindow(now), [now])

  const countLogs = (action: 'water' | 'wipe' | 'scan' | 'cure') => {
    return careLogs.filter(
      (log) => log.action === action && log.timestamp >= dayWindow.start && log.timestamp < dayWindow.end
    ).length
  }

  const waterProgress = careLogs.filter(
    (log) =>
      log.action === 'water' &&
      log.notes !== 'Plant added' &&
      log.timestamp >= dayWindow.start &&
      log.timestamp < dayWindow.end
  ).length

  const isClaimed = (missionId: string) => {
    return missionClaims.some(
      (claim) => claim.missionId === missionId && claim.periodKey === dayWindow.key
    )
  }

  const sickPlants = plants.filter((plant) => !!plant.pendingDiagnosis)
  const firstSickPlant = sickPlants[0]
  const dueWaterPlants = plants.filter((plant) => getWaterCycleRemainingMs(plant, now) <= 0)
  const waterTarget = 1
  const cleanTarget = 1

  const dailyTasks = useMemo<MissionTask[]>(() => {
    return [
      {
        id: 'daily-water',
        periodKey: dayWindow.key,
        kicker: 'Daily',
        title: 'Water run',
        meta: dueWaterPlants.length > 0
          ? `${dueWaterPlants[0].name} is past its water cycle.`
          : plants.length > 0
            ? 'No plants are due for water yet.'
            : 'Add a plant to start this task.',
        icon: <Droplets className="h-5 w-5" aria-hidden="true" />,
        tone: 'daily',
        progress: Math.min(waterProgress, waterTarget),
        target: waterTarget,
        reward: 20,
        deadlineAt: dayWindow.end,
        claimed: isClaimed('daily-water'),
        available: dueWaterPlants.length > 0,
        href: '/dashboard',
        actionLabel: 'Garden',
      },
      {
        id: 'daily-clean',
        periodKey: dayWindow.key,
        kicker: 'Daily',
        title: 'Leaf cleanup',
        meta: plants.length > 0 ? 'Wipe dusty leaves clean.' : 'Add a plant to unlock cleanup.',
        icon: <Leaf className="h-5 w-5" aria-hidden="true" />,
        tone: 'clean',
        progress: Math.min(countLogs('wipe'), cleanTarget),
        target: cleanTarget,
        reward: 15,
        deadlineAt: dayWindow.end,
        claimed: isClaimed('daily-clean'),
        available: plants.length > 0,
        href: '/dashboard',
        actionLabel: 'Garden',
      },
      {
        id: 'daily-scan',
        periodKey: dayWindow.key,
        kicker: 'Daily',
        title: 'Health scan',
        meta: plants.length > 0 ? 'Run one camera diagnosis.' : 'Add a plant before scanning.',
        icon: <ScanLine className="h-5 w-5" aria-hidden="true" />,
        tone: 'scan',
        progress: Math.min(countLogs('scan'), 1),
        target: 1,
        reward: 25,
        deadlineAt: dayWindow.end,
        claimed: isClaimed('daily-scan'),
        available: plants.length > 0,
        href: plants[0] ? `/camera?plantId=${plants[0].id}` : '/dashboard',
        actionLabel: plants.length > 0 ? 'Scan' : 'Garden',
      },
    ]
  }, [careLogs, cleanTarget, dayWindow.end, dayWindow.key, dayWindow.start, dueWaterPlants, missionClaims, plants, waterProgress, waterTarget])

  const emergencyTask = useMemo<MissionTask>(() => {
    const rescueCompletedToday = careLogs.some(
      (log) =>
        log.action === 'cure' &&
        log.notes === 'Rescue mission completed' &&
        log.timestamp >= dayWindow.start &&
        log.timestamp < dayWindow.end
    )

    if (!firstSickPlant) {
      return {
        id: 'emergency-cure',
        periodKey: dayWindow.key,
        kicker: 'Emergency',
        title: 'Plant rescue',
        meta: rescueCompletedToday ? 'Emergency treatment completed.' : 'No sick plants right now.',
        icon: <ShieldCheck className="h-5 w-5" aria-hidden="true" />,
        tone: 'emergency',
        progress: rescueCompletedToday ? 3 : 0,
        target: 3,
        reward: 75,
        deadlineAt: dayWindow.end,
        claimed: isClaimed('emergency-cure'),
        available: rescueCompletedToday,
      }
    }

    const diagnosisAt = Math.max(firstSickPlant.pendingDiagnosisAt ?? dayWindow.start, dayWindow.start)
    const rescueLogs = careLogs.filter(
      (log) =>
        log.plantId === firstSickPlant.id &&
        log.timestamp >= diagnosisAt &&
        log.timestamp < dayWindow.end
    )
    const lastWatered = firstSickPlant.lastWatered || 0
    const lastWipedAt = firstSickPlant.lastWipedAt || 0
    const waterDone = getPlantHp(firstSickPlant.id) >= 100 ||
      rescueLogs.some((log) => log.action === 'water') ||
      lastWatered >= diagnosisAt ||
      (lastWatered > 0 && diagnosisAt - lastWatered <= CARE_ACTION_COOLDOWN_MS)
    const wipeDone = rescueLogs.some((log) => log.action === 'wipe') ||
      lastWipedAt >= diagnosisAt ||
      (lastWipedAt > 0 && diagnosisAt - lastWipedAt <= CARE_ACTION_COOLDOWN_MS)
    const scanDone = rescueLogs.some(
      (log) => log.action === 'scan' && /healthy|clear/i.test(log.notes ?? '')
    )
    const checklist = [
      { id: 'water', label: `Water ${firstSickPlant.name}`, done: waterDone },
      { id: 'wipe', label: 'Wipe affected leaves', done: wipeDone },
      { id: 'scan', label: 'Scan again after care', done: scanDone },
    ]
    const firstIncomplete = checklist.find((item) => !item.done)
    const progress = checklist.filter((item) => item.done).length
    const guideSteps = firstSickPlant.pendingDiagnosis?.treatments?.slice(0, 4) ?? []

    return {
      id: 'emergency-cure',
      periodKey: dayWindow.key,
      kicker: 'Emergency',
      title: 'Plant rescue',
      meta: `${firstSickPlant.name}: ${firstSickPlant.pendingDiagnosis?.disease ?? 'disease alert'}`,
      icon: <AlertTriangle className="h-5 w-5" aria-hidden="true" />,
      tone: 'emergency',
      progress,
      target: checklist.length,
      reward: 75,
      deadlineAt: dayWindow.end,
      claimed: isClaimed('emergency-cure'),
      available: true,
      href: firstIncomplete?.id === 'scan' ? `/camera?plantId=${firstSickPlant.id}` : '/dashboard',
      actionLabel: firstIncomplete?.id === 'scan' ? 'Scan' : 'Care',
      guideSteps,
      checklist,
    }
  }, [careLogs, dayWindow.end, dayWindow.key, dayWindow.start, firstSickPlant, getPlantHp, missionClaims])

  const tasks = [...dailyTasks, emergencyTask]
  const completedCount = tasks.filter((task) => task.progress >= task.target).length
  const claimableCoins = tasks.reduce((sum, task) => {
    if (task.progress >= task.target && !task.claimed) return sum + task.reward
    return sum
  }, 0)

  const handleClaim = (task: MissionTask) => {
    if (task.progress < task.target || task.claimed) return
    if (task.id === 'emergency-cure' && firstSickPlant) {
      const completed = completeRescueMission(firstSickPlant.id)
      if (!completed) return
    }
    claimMissionReward(task.id, task.periodKey, task.reward)
  }

  return (
    <div className="page-stack">
      <section className="page-hero">
        <div className="page-container flex flex-wrap items-center justify-between gap-3 py-4 sm:flex-nowrap sm:gap-4 sm:py-5">
          <div className="min-w-0">
            <span className="section-kicker font-pixel text-[8px]">
              <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
              Mission Board
            </span>
            <h2 className="text-balance mt-2.5 font-pixel text-sm text-foreground sm:text-base">Missions</h2>
            <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
              Daily contracts reset in {formatTimeLeft(dayWindow.end, now)}.
            </p>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2">
            <div className="flex min-w-20 flex-col items-center gap-1 rounded-md border border-accent/35 bg-accent/12 px-3 py-2">
              <Coins className="h-4 w-4 text-accent" aria-hidden="true" />
              <div className="font-pixel text-base text-accent sm:text-xl">{claimableCoins}</div>
              <div className="font-pixel text-[6px] text-muted-foreground">ready GC</div>
            </div>
            <div className="flex min-w-20 flex-col items-center gap-1 rounded-md border border-primary/20 bg-secondary/60 px-3 py-2">
              <Trophy className="h-4 w-4 text-primary" aria-hidden="true" />
              <div className="font-pixel text-base text-primary sm:text-xl">{completedCount}/{tasks.length}</div>
              <div className="font-pixel text-[6px] text-muted-foreground">done</div>
            </div>
          </div>
        </div>
      </section>

      <div className="page-container pt-0">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(290px,360px)]">
          <section className="grid min-w-0 gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="font-pixel text-[8px] text-muted-foreground">Daily</span>
                <h3 className="mt-1 font-pixel text-xs text-foreground">Care contracts</h3>
              </div>
              <span className="rounded-md border border-primary/20 bg-secondary/60 px-2.5 py-1.5 font-pixel text-[7px] text-primary">
                {formatTimeLeft(dayWindow.end, now)}
              </span>
            </div>

            {dailyTasks.map((task) => (
              <MissionCard key={task.id} task={task} now={now} onClaim={handleClaim} />
            ))}
          </section>

          <aside className="grid min-w-0 content-start gap-3">
            <div>
              <span className="font-pixel text-[8px] text-muted-foreground">Emergency</span>
              <h3 className="mt-1 font-pixel text-xs text-foreground">Rescue queue</h3>
            </div>

            <MissionCard task={emergencyTask} now={now} onClaim={handleClaim} />

            <section className="surface-panel p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="font-pixel text-[8px] text-muted-foreground">Wallet</span>
                  <div className="mt-1 flex items-center gap-1 font-pixel text-sm text-accent">
                    <Coins className="h-4 w-4" aria-hidden="true" />
                    {coins} GC
                  </div>
                </div>
                <div className="grid h-11 w-11 place-items-center rounded-md bg-primary text-primary-foreground">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                <div className="flex items-center justify-between rounded-md border border-border/70 bg-card/70 px-3 py-2">
                  <span className="font-pixel text-[8px] text-muted-foreground">Plants</span>
                  <span className="font-pixel text-[9px] text-foreground">{plants.length}</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-border/70 bg-card/70 px-3 py-2">
                  <span className="font-pixel text-[8px] text-muted-foreground">Alerts</span>
                  <span className={cn('font-pixel text-[9px]', sickPlants.length > 0 ? 'text-destructive' : 'text-primary')}>
                    {sickPlants.length}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-border/70 bg-card/70 px-3 py-2">
                  <span className="font-pixel text-[8px] text-muted-foreground">Claimable</span>
                  <span className="font-pixel text-[9px] text-accent">+{claimableCoins} GC</span>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}
