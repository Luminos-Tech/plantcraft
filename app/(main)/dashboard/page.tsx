'use client'

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import {
  Activity,
  Clock3,
  Droplets,
  History,
  Leaf,
  Plus,
  ScanLine,
  Sparkles,
  Sprout,
  TreeDeciduous,
} from 'lucide-react'
import { CARE_ACTION_COOLDOWN_MS, type Plant, useGameStore } from '@/lib/store'
import { PlantCard } from '@/components/plant-card'
import { EmptyGarden } from '@/components/empty-garden'
import { AddPlantModal } from '@/components/add-plant-modal'
import { CareHistorySheet } from '@/components/care-history-sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const WIPE_TASK_INTERVAL_MS = 12 * 60 * 60 * 1000

const MAP_POSITIONS = [
  { x: 27, y: 32 },
  { x: 62, y: 25 },
  { x: 48, y: 55 },
  { x: 75, y: 60 },
  { x: 20, y: 68 },
  { x: 38, y: 18 },
  { x: 84, y: 38 },
  { x: 56, y: 78 },
] as const

type PlantStatus = 'healthy' | 'care' | 'critical' | 'diagnosis'

interface PlantStat {
  plant: Plant
  hp: number
  position: (typeof MAP_POSITIONS)[number]
  status: PlantStatus
  needsWater: boolean
  needsWipe: boolean
  hasDiagnosis: boolean
}

interface CareTask {
  id: string
  plantId: string
  title: string
  meta: string
  icon: ReactNode
  tone: 'danger' | 'warning' | 'primary'
  action: () => void
}

function getPlantTone(hp: number, hasDiagnosis: boolean): PlantStatus {
  if (hasDiagnosis) return 'diagnosis'
  if (hp < 30) return 'critical'
  if (hp < 75) return 'care'
  return 'healthy'
}

function formatTimeAgo(timestamp?: number) {
  if (!timestamp) return 'new'

  const diff = Math.max(0, Date.now() - timestamp)
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`

  return `${Math.floor(hours / 24)}d`
}

function getCareLabel(action: string) {
  switch (action) {
    case 'water':
      return 'Watered'
    case 'wipe':
      return 'Wiped'
    case 'scan':
      return 'Scanned'
    case 'decorate':
      return 'Decorated'
    case 'cure':
      return 'Cured'
    case 'fertilize':
      return 'Fertilized'
    default:
      return action
  }
}

export default function DashboardPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null)
  const [editingPlantId, setEditingPlantId] = useState<string | null>(null)
  const [clock, setClock] = useState(() => Date.now())
  const { plants, careLogs, getPlantHp, waterPlant, wipePlant } = useGameStore()

  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 30000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (plants.length === 0) {
      setSelectedPlantId(null)
      return
    }

    if (!selectedPlantId || !plants.some((plant) => plant.id === selectedPlantId)) {
      setSelectedPlantId(plants[0].id)
    }
  }, [plants, selectedPlantId])

  const plantStats = useMemo<PlantStat[]>(() => {
    return plants.map((plant, index) => {
      const hp = getPlantHp(plant.id)
      const hasDiagnosis = !!plant.pendingDiagnosis
      const lastWatered = plant.lastWatered || plant.createdAt || clock
      const lastWipedAt = plant.lastWipedAt || plant.createdAt || 0
      const needsWater = hp < 95 && clock - lastWatered >= CARE_ACTION_COOLDOWN_MS
      const needsWipe = clock - lastWipedAt >= WIPE_TASK_INTERVAL_MS

      return {
        plant,
        hp,
        hasDiagnosis,
        needsWater,
        needsWipe,
        position: MAP_POSITIONS[index % MAP_POSITIONS.length],
        status: getPlantTone(hp, hasDiagnosis),
      }
    })
  }, [clock, getPlantHp, plants])

  const selectedStat = plantStats.find((stat) => stat.plant.id === selectedPlantId) ?? plantStats[0]
  const selectedPlant = selectedStat?.plant
  const editingPlant = plants.find((plant) => plant.id === editingPlantId) ?? null
  const healthyCount = plantStats.filter((stat) => stat.status === 'healthy').length
  const urgentCount = plantStats.filter((stat) => stat.status === 'critical' || stat.status === 'diagnosis').length
  const gardenStability = plants.length > 0 ? Math.round((healthyCount / plants.length) * 100) : 0

  const careTasks = useMemo<CareTask[]>(() => {
    return plantStats
      .reduce<CareTask[]>((tasks, stat) => {
        if (stat.hasDiagnosis) {
          tasks.push({
            id: `${stat.plant.id}-diagnosis`,
            plantId: stat.plant.id,
            title: stat.plant.pendingDiagnosis?.disease ?? 'Check diagnosis',
            meta: stat.plant.name,
            icon: <Activity className="h-3.5 w-3.5" aria-hidden="true" />,
            tone: 'danger',
            action: () => setSelectedPlantId(stat.plant.id),
          })
          return tasks
        }

        if (stat.needsWater) {
          tasks.push({
            id: `${stat.plant.id}-water`,
            plantId: stat.plant.id,
            title: 'Water queue',
            meta: `${stat.plant.name} - ${stat.hp} HP`,
            icon: <Droplets className="h-3.5 w-3.5" aria-hidden="true" />,
            tone: stat.hp < 40 ? 'danger' : 'warning',
            action: () => {
              setSelectedPlantId(stat.plant.id)
              waterPlant(stat.plant.id)
            },
          })
          return tasks
        }

        if (stat.needsWipe) {
          tasks.push({
            id: `${stat.plant.id}-wipe`,
            plantId: stat.plant.id,
            title: 'Leaf polish',
            meta: stat.plant.name,
            icon: <Leaf className="h-3.5 w-3.5" aria-hidden="true" />,
            tone: 'primary',
            action: () => {
              setSelectedPlantId(stat.plant.id)
              wipePlant(stat.plant.id)
            },
          })
        }

        return tasks
      }, [])
      .slice(0, 6)
  }, [plantStats, waterPlant, wipePlant])

  const recentLogs = useMemo(() => {
    return careLogs.slice(0, 4).map((log) => ({
      ...log,
      plantName: plants.find((plant) => plant.id === log.plantId)?.name ?? 'Garden',
    }))
  }, [careLogs, plants])

  return (
    <div className="page-stack">
      <section className="page-hero">
        <div className="page-container flex items-center justify-between gap-4 py-4 sm:py-5">
          <div className="min-w-0">
            <span className="section-kicker font-pixel text-[8px]">
              <Sprout className="h-3.5 w-3.5" aria-hidden="true" />
              Live Field
            </span>
            <h2 className="text-balance mt-2.5 font-pixel text-sm text-foreground sm:text-base">My Garden</h2>
            <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">Map, queue, and care actions in one view.</p>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2">
            <div className="flex min-w-20 flex-col items-center gap-1 rounded-md border border-primary/20 bg-secondary/60 px-3 py-2">
              <TreeDeciduous className="h-4 w-4 text-primary" aria-hidden="true" />
              <div className="font-pixel text-base text-primary sm:text-xl">{plants.length}</div>
              <div className="font-pixel text-[6px] text-muted-foreground">plants</div>
            </div>
            <div className="flex min-w-20 flex-col items-center gap-1 rounded-md border border-accent/35 bg-accent/12 px-3 py-2">
              <Activity className="h-4 w-4 text-accent" aria-hidden="true" />
              <div className="font-pixel text-base text-accent sm:text-xl">{urgentCount}</div>
              <div className="font-pixel text-[6px] text-muted-foreground">alerts</div>
            </div>
          </div>
        </div>
      </section>

      <div className="page-container dashboard-command-center pt-0">
        {plants.length === 0 ? (
          <div className="dashboard-empty-grid">
            <div className="garden-map-shell min-h-[360px]">
              <div className="garden-map-surface">
                <div className="map-scan-ring" />
                <div className="map-status-pill">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="font-pixel text-[7px]">Ready</span>
                </div>
              </div>
            </div>
            <EmptyGarden onAddPlant={() => setIsAddModalOpen(true)} />
          </div>
        ) : (
          <div className="dashboard-grid">
            <section className="dashboard-map-column">
              <div className="garden-map-shell">
                <div className="garden-map-surface">
                  <div className="map-scan-ring" />
                  <div className="map-route map-route-a" />
                  <div className="map-route map-route-b" />

                  <div className="map-status-pill">
                    <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="font-pixel text-[7px]">{gardenStability}% stable</span>
                  </div>

                  <div className="map-compass">
                    <ScanLine className="h-4 w-4" aria-hidden="true" />
                  </div>

                  {plantStats.map((stat) => {
                    const isSelected = stat.plant.id === selectedStat?.plant.id
                    const markerStyle = {
                      left: `${stat.position.x}%`,
                      top: `${stat.position.y}%`,
                      '--marker-hp': `${stat.hp}%`,
                    } as CSSProperties

                    return (
                      <button
                        key={stat.plant.id}
                        type="button"
                        style={markerStyle}
                        className={cn(
                          'plant-map-marker',
                          `plant-map-marker-${stat.status}`,
                          isSelected && 'is-selected'
                        )}
                        onClick={() => setSelectedPlantId(stat.plant.id)}
                        aria-label={`Select ${stat.plant.name}`}
                      >
                        <span className="plant-map-marker-orbit" />
                        <span className="plant-map-marker-avatar">
                          {stat.plant.imageUrl ? (
                            <img src={stat.plant.imageUrl} alt="" />
                          ) : (
                            <Sprout className="h-5 w-5" aria-hidden="true" />
                          )}
                        </span>
                        <span className="plant-map-marker-name font-pixel">{stat.plant.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {selectedPlant && (
                <div className="selected-plant-panel">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-pixel text-[8px] text-muted-foreground">Selected plant</span>
                      <h3 className="mt-1 truncate font-pixel text-xs text-foreground">{selectedPlant.name}</h3>
                    </div>
                    <div className="rounded-md border border-primary/20 bg-secondary/70 px-3 py-2 text-right">
                      <div className="font-pixel text-sm text-primary">{selectedStat.hp}</div>
                      <div className="font-pixel text-[6px] text-muted-foreground">HP</div>
                    </div>
                  </div>
                  <PlantCard
                    plant={selectedPlant}
                    compact
                    onEdit={(plant) => setEditingPlantId(plant.id)}
                  />
                </div>
              )}
            </section>

            <aside className="dashboard-side-panel">
              <section className="surface-panel care-queue-panel">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="font-pixel text-[8px] text-muted-foreground">Care queue</span>
                    <h3 className="mt-1 font-pixel text-xs text-foreground">Today</h3>
                  </div>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setIsHistoryOpen(true)}
                    className="rounded-md border-primary/40 bg-card"
                    title="Care history"
                  >
                    <History className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>

                <div className="mt-4 grid gap-2">
                  {careTasks.length === 0 ? (
                    <div className="rounded-md border border-primary/15 bg-secondary/45 p-4">
                      <div className="flex items-center gap-2 font-pixel text-[9px] text-primary">
                        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                        Clear field
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">All plants are steady right now.</p>
                    </div>
                  ) : (
                    careTasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={task.action}
                        className={cn(
                          'care-task-row',
                          task.tone === 'danger' && 'care-task-row-danger',
                          task.tone === 'warning' && 'care-task-row-warning'
                        )}
                      >
                        <span className="care-task-icon">{task.icon}</span>
                        <span className="min-w-0 flex-1 text-left">
                          <span className="block truncate font-pixel text-[8px] text-foreground">{task.title}</span>
                          <span className="mt-1 block truncate text-xs text-muted-foreground">{task.meta}</span>
                        </span>
                        <Sparkles className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      </button>
                    ))
                  )}
                </div>
              </section>

              <section className="surface-panel activity-panel">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="font-pixel text-[8px] text-muted-foreground">Activity</span>
                    <h3 className="mt-1 font-pixel text-xs text-foreground">Recent</h3>
                  </div>
                  <Clock3 className="h-4 w-4 text-primary" aria-hidden="true" />
                </div>

                <div className="mt-4 grid gap-2">
                  {recentLogs.length === 0 ? (
                    <p className="rounded-md border border-border/70 bg-card/70 p-4 text-sm text-muted-foreground">
                      No garden actions yet.
                    </p>
                  ) : (
                    recentLogs.map((log) => (
                      <div key={log.id} className="activity-row">
                        <span className="activity-dot" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-pixel text-[8px] text-foreground">
                            {getCareLabel(log.action)}
                          </span>
                          <span className="mt-1 block truncate text-xs text-muted-foreground">{log.plantName}</span>
                        </span>
                        <span className="font-pixel text-[7px] text-muted-foreground">{formatTimeAgo(log.timestamp)}</span>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </aside>

            <section className="dashboard-roster">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <span className="font-pixel text-[8px] text-muted-foreground">Roster</span>
                  <h3 className="mt-1 font-pixel text-xs text-foreground">All plants</h3>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setIsAddModalOpen(true)}
                  className="rounded-md border-primary/50 bg-card/90 font-pixel text-[8px]"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add
                </Button>
              </div>
              <div className="plant-grid">
                {plants.map((plant) => (
                  <PlantCard
                    key={plant.id}
                    plant={plant}
                    compact
                    selected={plant.id === selectedPlant?.id}
                    className="plant-card-selector"
                    onSelect={() => setSelectedPlantId(plant.id)}
                    onEdit={(plant) => setEditingPlantId(plant.id)}
                  />
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Modals */}
      <AddPlantModal
        open={isAddModalOpen || !!editingPlant}
        onOpenChange={(open) => {
          setIsAddModalOpen(open && !editingPlant)
          if (!open) setEditingPlantId(null)
        }}
        plant={editingPlant}
      />
      <CareHistorySheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen} />
    </div>
  )
}
