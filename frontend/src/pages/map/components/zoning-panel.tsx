import { useState } from 'react'
import { CalendarDays, LayoutGrid, Loader2, MoreHorizontal, Plus } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useMapContext } from '@/context/map.context'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useZoningPanel, type ZoningScenarioGroup } from '@/composable/map.composable'
import { usePermission } from '@/hooks/use-permission'
import { PERMISSION } from '@/config/permissions'

const HEX_RE = /^#[0-9a-fA-F]{3,8}$/

function zoneTypeLabel(type: string): string {
  if (type === '(unlabelled)') return '(unlabelled)'
  if (HEX_RE.test(type)) return 'Unlabelled (OCR)'
  return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')
}

function scenarioLabel(group: ZoningScenarioGroup): string {
  if (group.scenario === null) return 'No scenario'
  if (group.scenarioType === 'year')  return `${group.scenario} (year)`
  if (group.scenarioType === 'month') return `${group.scenario} (month)`
  return group.scenario
}

// ── ZoneTypeRow ────────────────────────────────────────────────────────────

interface ZoneTypeRowProps {
  typeKey:   string
  label:     string
  count:     number
  color:     string | null
  isVisible: boolean
  isGroup?:  boolean
  groupKeys?: string[]
  allFilterKeys: string[]
  canWrite:  boolean
  onNavigate: () => void
}

function ZoneTypeRow({ typeKey, label, count, color, isVisible, isGroup, groupKeys, allFilterKeys, canWrite, onNavigate }: ZoneTypeRowProps) {
  const { toggleZoningType, toggleZoningTypeGroup } = useMapContext()

  function handleToggle() {
    if (isGroup && groupKeys) {
      toggleZoningTypeGroup(groupKeys, allFilterKeys)
    } else {
      toggleZoningType(typeKey, allFilterKeys)
    }
  }

  return (
    <div className="flex items-center gap-2 py-1.5 group">
      <div
        className="size-2.5 rounded-sm shrink-0 border border-white/10"
        style={{ background: color ?? '#888' }}
      />
      <span className={cn('text-xs truncate flex-1', !isVisible && 'opacity-40 line-through')}>
        {label}
      </span>
      <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">{count}</span>

      <Switch
        checked={isVisible}
        onCheckedChange={handleToggle}
        className="shrink-0 scale-75"
      />

      {canWrite && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
              aria-label="Zone type actions"
            >
              <MoreHorizontal className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[150px]">
            <DropdownMenuItem onClick={onNavigate} className="text-xs gap-2">
              <Plus className="size-3.5" />
              Add zones
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

// ── ScenarioSection ────────────────────────────────────────────────────────

interface ScenarioSectionProps {
  group:         ZoningScenarioGroup
  allFilterKeys: string[]
  canWrite:      boolean
  showZoning:    boolean
  visibleZoningTypes: Set<string> | null
  onNavigate:    () => void
}

function ScenarioSection({ group, allFilterKeys, canWrite, showZoning, visibleZoningTypes, onNavigate }: ScenarioSectionProps) {
  const namedTypes = group.zoneTypes.filter(([t]) => !HEX_RE.test(t))
  const ocrTypes   = group.zoneTypes.filter(([t]) => HEX_RE.test(t))
  const ocrKeys    = ocrTypes.map(([t]) => t)
  const ocrCount   = ocrTypes.reduce((s, [, n]) => s + n, 0)

  return (
    <div className="space-y-0">
      {namedTypes.map(([type, count]) => {
        const typeKey   = type === '(unlabelled)' ? '' : type
        const isVisible = showZoning && (visibleZoningTypes === null || visibleZoningTypes.has(typeKey))
        return (
          <ZoneTypeRow
            key={type}
            typeKey={typeKey}
            label={zoneTypeLabel(type)}
            count={count}
            color={group.zoneColors[type] ?? null}
            isVisible={isVisible}
            allFilterKeys={allFilterKeys}
            canWrite={canWrite}
            onNavigate={onNavigate}
          />
        )
      })}

      {ocrCount > 0 && (
        <ZoneTypeRow
          typeKey="__ocr__"
          label="Unlabelled (OCR)"
          count={ocrCount}
          color={ocrKeys[0] ? (group.zoneColors[ocrKeys[0]] ?? null) : null}
          isVisible={showZoning && (visibleZoningTypes === null || ocrKeys.some(k => visibleZoningTypes!.has(k)))}
          isGroup
          groupKeys={ocrKeys}
          allFilterKeys={allFilterKeys}
          canWrite={canWrite}
          onNavigate={onNavigate}
        />
      )}
    </div>
  )
}

// ── ZoningPanel ────────────────────────────────────────────────────────────

export function ZoningPanel() {
  const { visibleZoningTypes, showZoning } = useMapContext()
  const { pmtileUrl, zones, zoneTypes, zoneColors, scenarioGroups, isLoading } = useZoningPanel()
  const canWrite = usePermission(PERMISSION.ZONING_WRITE)
  const navigate = useNavigate()

  const [activeScenario, setActiveScenario] = useState<'all' | string>('all')

  function goToZoning() { void navigate({ to: '/zoning' as never }) }

  const allFilterKeys = zoneTypes.map(([t]) => t === '(unlabelled)' ? '' : t)

  if (isLoading) return (
    <div className="flex flex-1 items-center justify-center gap-2 text-xs text-muted-foreground">
      <Loader2 className="size-3.5 animate-spin" /> Loading zones…
    </div>
  )

  if (!pmtileUrl && zones.length === 0) return (
    <div className="flex flex-1 items-center justify-center px-4 text-center">
      <div className="space-y-2.5">
        <LayoutGrid className="mx-auto size-8 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          No zoning data for this city yet.
        </p>
        {canWrite && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={goToZoning}>
            <Plus className="size-3.5" /> Add Zoning Data
          </Button>
        )}
      </div>
    </div>
  )

  const hasScenarios = scenarioGroups.some(g => g.scenario !== null)

  const displayGroups: ZoningScenarioGroup[] =
    activeScenario === 'all'
      ? scenarioGroups
      : scenarioGroups.filter(g => (g.scenario ?? '__none__') === activeScenario)

  return (
    <div className="flex flex-col flex-1 min-h-0">

      {/* Header row */}
      <div className="px-3 pt-2 pb-1 shrink-0 flex items-center gap-2">
        {pmtileUrl && (
          <>
            <div className="size-2 rounded-full bg-green-500 shrink-0" />
            <span className="text-[11px] text-muted-foreground flex-1">Tile layer loaded</span>
          </>
        )}
        {canWrite && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 ml-auto" onClick={goToZoning}>
            <Plus className="size-3.5" /> Add
          </Button>
        )}
      </div>

      {/* Scenario tabs — only shown when there are multiple scenarios */}
      {hasScenarios && (
        <>
          <div className="px-2 pb-1 shrink-0 overflow-x-auto scrollbar-none">
            <div className="flex gap-1 pb-0.5">
              <button
                onClick={() => setActiveScenario('all')}
                className={cn(
                  'shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap',
                  activeScenario === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                All
              </button>
              {scenarioGroups.map(g => {
                const key = g.scenario ?? '__none__'
                return (
                  <button
                    key={key}
                    onClick={() => setActiveScenario(key)}
                    className={cn(
                      'shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap flex items-center gap-1',
                      activeScenario === key
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                    )}
                  >
                    {g.scenario !== null && <CalendarDays className="size-2.5" />}
                    {scenarioLabel(g)}
                  </button>
                )
              })}
            </div>
          </div>
          <Separator className="shrink-0 opacity-40" />
        </>
      )}

      {/* Zone list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-3 py-2 space-y-3">

          {/* Summary line */}
          <p className="text-[10px] font-medium text-muted-foreground">
            {zones.length} zone{zones.length !== 1 ? 's' : ''} · {zoneTypes.length} type{zoneTypes.length !== 1 ? 's' : ''}
            {hasScenarios && ` · ${scenarioGroups.filter(g => g.scenario !== null).length} scenario${scenarioGroups.filter(g => g.scenario !== null).length !== 1 ? 's' : ''}`}
          </p>

          {activeScenario === 'all' && hasScenarios
            ? /* Grouped view: one section per scenario */
              displayGroups.map((group, gi) => (
                <div key={group.scenario ?? '__none__'}>
                  {gi > 0 && <Separator className="mb-3 opacity-30" />}
                  <div className="flex items-center gap-1.5 mb-1">
                    {group.scenario !== null
                      ? <CalendarDays className="size-3 text-muted-foreground shrink-0" />
                      : <LayoutGrid className="size-3 text-muted-foreground shrink-0" />}
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                      {scenarioLabel(group)}
                    </span>
                    <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
                      {group.zoneTypes.reduce((s, [, n]) => s + n, 0)}
                    </span>
                  </div>
                  <ScenarioSection
                    group={group}
                    allFilterKeys={allFilterKeys}
                    canWrite={canWrite}
                    showZoning={showZoning}
                    visibleZoningTypes={visibleZoningTypes}
                    onNavigate={goToZoning}
                  />
                </div>
              ))
            : activeScenario === 'all'
            ? /* Flat view (no scenarios exist) */
              (() => {
                const flatGroup: ZoningScenarioGroup = {
                  scenario: null, scenarioType: null,
                  zoneTypes: zoneTypes.map(([t, n]) => [t, n]),
                  zoneColors,
                }
                return (
                  <ScenarioSection
                    group={flatGroup}
                    allFilterKeys={allFilterKeys}
                    canWrite={canWrite}
                    showZoning={showZoning}
                    visibleZoningTypes={visibleZoningTypes}
                    onNavigate={goToZoning}
                  />
                )
              })()
            : /* Filtered single-scenario view */
              displayGroups.map(group => (
                <ScenarioSection
                  key={group.scenario ?? '__none__'}
                  group={group}
                  allFilterKeys={allFilterKeys}
                  canWrite={canWrite}
                  showZoning={showZoning}
                  visibleZoningTypes={visibleZoningTypes}
                  onNavigate={goToZoning}
                />
              ))}
        </div>
      </ScrollArea>
    </div>
  )
}
