import { useState, useEffect } from 'react'
import { Plus, Minus } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { useMapContext } from '@/context/map.context'
import { usePermission } from '@/hooks/use-permission'
import { PERMISSION } from '@/config/permissions'

const HAZARD_COLORS: Record<string, string> = {
  flood:       'data-checked:bg-blue-500',
  landslide:   'data-checked:bg-orange-500',
  storm_surge: 'data-checked:bg-purple-500',
  debris_flow: 'data-checked:bg-amber-600',
  faultline:   'data-checked:bg-red-500',
}
const FALLBACK_COLOR = 'data-checked:bg-slate-500'

const SCENARIO_DESCRIPTIONS: Record<string, string> = {
  '5yr':   'Frequent event — low severity flooding',
  '25yr':  'Moderate event — significant flood risk',
  '100yr': 'Rare event — high severity, major impact',
  'ssa1':  'Storm surge up to 1 m — minimal coastal threat',
  'ssa2':  'Storm surge 1–3 m — moderate coastal threat',
  'ssa3':  'Storm surge 3–5 m — severe coastal flooding',
  'ssa4':  'Storm surge above 5 m — extreme threat',
}

function formatHazardLabel(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatScenarioLabel(scenario: string | null): string {
  if (!scenario) return 'All Features'
  const yr = scenario.match(/^(\d+)yr$/i)
  if (yr) return `${yr[1]}-Year Return`
  const ssa = scenario.match(/^ssa(\d+)$/i)
  if (ssa) return `SSA Level ${ssa[1]}`
  return scenario.toUpperCase()
}

const SWITCH_BASE = 'shrink-0 data-unchecked:bg-muted-foreground/20'

export function HazardPanel() {
  const { visibleHazardKeys, toggleHazard, hazardLayers, refreshHazardLayers } = useMapContext()
  const canWrite = usePermission(PERMISSION.HAZARD_WRITE)
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Sync engine layers with latest DB state each time the panel opens.
  // Catches PMTiles added after the initial city-load fetch.
  useEffect(() => {
    void refreshHazardLayers()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tiles = hazardLayers

  const typeOrder = [...new Set(tiles.map(t => t.hazard_type))]
  const groups = typeOrder.map(type => ({
    type,
    tiles: tiles.filter(t => t.hazard_type === type),
  }))

  function toggleExpanded(type: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  if (groups.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1 text-xs text-muted-foreground py-8">
        No hazard data for this city
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
    {canWrite && (
      <div className="px-3 pt-2 pb-1 shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="h-7 w-full text-xs gap-1.5"
          onClick={() => void navigate({ to: '/hazard' as never })}
        >
          <Plus className="size-3.5" /> Add Hazard Data
        </Button>
      </div>
    )}
    <ScrollArea className="flex-1 min-h-0">
      <div className="px-3 pb-3 space-y-1">
        {groups.map((group, gi) => {
          const hasScenarios = group.tiles.length > 1
          const isExpanded = expanded.has(group.type)
          const switchColor = HAZARD_COLORS[group.type] ?? FALLBACK_COLOR

          if (!hasScenarios) {
            const tile = group.tiles[0]
            const key = `${tile.hazard_type}::${tile.scenario ?? 'all'}`
            return (
              <div key={group.type}>
                {gi > 0 && <Separator className="mb-1" />}
                <div className="flex items-center justify-between py-2 gap-2">
                  <span className="text-xs font-semibold truncate flex-1">
                    {formatHazardLabel(group.type)}
                  </span>
                  <Switch
                    checked={visibleHazardKeys.has(key)}
                    onCheckedChange={() => toggleHazard(key)}
                    className={cn(SWITCH_BASE, 'scale-90', switchColor)}
                  />
                </div>
              </div>
            )
          }

          return (
            <div key={group.type}>
              {gi > 0 && <Separator className="mb-1" />}

              <div className="flex items-center justify-between py-2 gap-2">
                <span className="text-xs font-semibold truncate flex-1">
                  {formatHazardLabel(group.type)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  onClick={() => toggleExpanded(group.type)}
                >
                  {isExpanded ? <Minus className="size-3" /> : <Plus className="size-3" />}
                </Button>
              </div>

              {isExpanded && (
                <div className="ml-3 mb-1 border-l border-border/50 pl-3 space-y-0">
                  {group.tiles.map((tile, ti) => {
                    const key = `${tile.hazard_type}::${tile.scenario ?? 'all'}`
                    const desc = tile.scenario ? SCENARIO_DESCRIPTIONS[tile.scenario] : undefined
                    return (
                      <div key={key}>
                        {ti > 0 && <Separator className="my-0 opacity-30" />}
                        <div className="flex items-center justify-between py-2 gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-medium leading-tight">
                              {formatScenarioLabel(tile.scenario)}
                            </div>
                            {desc && (
                              <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                                {desc}
                              </div>
                            )}
                          </div>
                          <Switch
                            checked={visibleHazardKeys.has(key)}
                            onCheckedChange={() => toggleHazard(key)}
                            className={cn(SWITCH_BASE, 'scale-75', switchColor)}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </ScrollArea>
    </div>
  )
}
