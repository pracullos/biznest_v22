import { useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2, Move, Pencil, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useMapContext } from '@/context/map.context'
import { useCityContext } from '@/context/city.context'
import { useDrawPolygon, type DrawMode } from '@/composable/map.composable'

const API_URL = import.meta.env.VITE_API_URL as string

const HAZARD_TYPES = ['flood', 'landslide', 'storm_surge', 'debris_flow', 'faultline'] as const
const SCENARIOS    = ['5yr', '25yr', '100yr', 'ssa1', 'ssa2', 'ssa3', 'ssa4'] as const
const ZONE_TYPES   = ['residential', 'commercial', 'industrial', 'agriculture'] as const

type HazardType = (typeof HAZARD_TYPES)[number]
type Scenario   = (typeof SCENARIOS)[number]
type ZoneType   = (typeof ZONE_TYPES)[number]

interface DrawPanelProps {
  variant: 'hazard' | 'zoning'
  onBack: () => void
  onSaved?: () => void
}

export function DrawPanel({ variant, onBack, onSaved }: DrawPanelProps) {
  const { engine, refreshZoningLayer, refreshHazardLayers, toggleHazard } = useMapContext()
  const { cityId }                     = useCityContext()

  const { isActive, drawnGeometry, pointCount, activate, deactivate, clearDrawn } =
    useDrawPolygon(engine)

  const [drawMode,   setDrawMode]   = useState<DrawMode>('draw_polygon')
  const [hazardType, setHazardType] = useState<HazardType>('flood')
  const [scenario,   setScenario]   = useState<Scenario>('100yr')
  const [zoneType,   setZoneType]   = useState<ZoneType>('residential')
  const [severity,   setSeverity]   = useState(3)
  const [status,     setStatus]     = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [errorMsg,   setErrorMsg]   = useState('')

  // Cleanup drawing when panel unmounts
  useEffect(() => () => deactivate(), [deactivate])

  function handleBack() {
    deactivate()
    onBack()
  }

  async function handleSave() {
    if (!drawnGeometry || !cityId) return
    setStatus('saving')
    setErrorMsg('')

    try {
      const endpoint = variant === 'hazard'
        ? `${API_URL}/cities/${cityId}/hazards`
        : `${API_URL}/cities/${cityId}/zoning`

      const body = variant === 'hazard'
        ? { hazard_type: hazardType, scenario, severity, geometry: drawnGeometry }
        : { city_id: cityId, zone_type: zoneType, severity, geometry: drawnGeometry }

      const res = await fetch(endpoint, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { detail?: string }
        throw new Error(data.detail ?? `HTTP ${res.status}`)
      }

      // Regenerate PMTile so the drawn shape appears on the map immediately
      if (variant === 'zoning') {
        const regen = await fetch(`${API_URL}/cities/${cityId}/zoning/regenerate-pmtiles`, {
          method: 'POST', credentials: 'include',
        })
        if (regen.ok) {
          const { pmtile_url } = await regen.json() as { pmtile_url: string }
          await refreshZoningLayer(pmtile_url)
        }
      } else {
        // Hazard: regenerate city-level PMTile, then reload and auto-enable the layer
        const params = new URLSearchParams({ hazard_type: hazardType, ...(scenario ? { scenario } : {}) })
        const regen  = await fetch(
          `${API_URL}/cities/${cityId}/hazards/regenerate-pmtiles?${params.toString()}`,
          { method: 'POST', credentials: 'include' },
        )
        if (regen.ok) {
          await refreshHazardLayers()
          // Auto-enable the layer the user just drew so it's immediately visible
          const layerKey = `${hazardType}::${scenario ?? 'all'}`
          toggleHazard(layerKey)
        }
      }

      setStatus('success')
      clearDrawn()
      onSaved?.()
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Save failed')
    }
  }

  const selectClass =
    'w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs ' +
    'focus:outline-none focus:ring-1 focus:ring-ring capitalize'

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-2 shrink-0">
        <Button variant="ghost" size="icon" className="size-6 -ml-1" onClick={handleBack}>
          <ArrowLeft className="size-3.5" />
        </Button>
        <span className="text-xs font-medium">
          Draw {variant === 'hazard' ? 'Hazard' : 'Zoning'} Area
        </span>
      </div>

      <Separator className="shrink-0" />

      <div className="flex flex-col gap-3 p-3 overflow-y-auto">

        {/* ── Draw mode selector ─────────────────────────────────────── */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Draw Mode
          </span>
          <div className="flex gap-1">
            {(['draw_polygon', 'draw_freehand'] as const).map(m => (
              <button
                key={m}
                disabled={isActive}
                onClick={() => setDrawMode(m)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs',
                  'border transition-all disabled:pointer-events-none disabled:opacity-50',
                  drawMode === m
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground',
                )}
              >
                {m === 'draw_polygon'
                  ? <Pencil className="size-3" />
                  : <Move className="size-3" />}
                {m === 'draw_polygon' ? 'Polygon' : 'Freehand'}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            {drawMode === 'draw_polygon'
              ? 'Click to place points · double-click to finish'
              : 'Click the button below, then hold and drag on the map'}
          </p>
        </div>

        <Separator />

        {/* ── Type-specific fields ───────────────────────────────────── */}
        {variant === 'hazard' ? (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Hazard Type
              </label>
              <select
                value={hazardType}
                onChange={e => setHazardType(e.target.value as HazardType)}
                className={selectClass}
              >
                {HAZARD_TYPES.map(t => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Scenario
              </label>
              <select
                value={scenario}
                onChange={e => setScenario(e.target.value as Scenario)}
                className={selectClass}
              >
                {SCENARIOS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Zone Type
            </label>
            <select
              value={zoneType}
              onChange={e => setZoneType(e.target.value as ZoneType)}
              className={selectClass}
            >
              {ZONE_TYPES.map(t => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ── Severity ──────────────────────────────────────────────── */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Severity
            </label>
            <span className="text-xs font-semibold tabular-nums">{severity} / 5</span>
          </div>
          <input
            type="range"
            min={1} max={5} step={1}
            value={severity}
            onChange={e => setSeverity(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>

        <Separator />

        {/* ── Start / cancel drawing ─────────────────────────────────── */}
        <Button
          size="sm"
          variant={isActive ? 'outline' : 'default'}
          className="w-full text-xs h-8"
          onClick={() => isActive ? deactivate() : void activate(drawMode)}
        >
          {isActive ? 'Cancel Drawing' : 'Start Drawing'}
        </Button>

        {/* ── Drawn shape preview status ─────────────────────────────── */}
        {drawnGeometry && (
          <div className="rounded-md bg-muted/60 px-3 py-2 text-[11px] flex items-center gap-2">
            <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />
            <span>
              Shape ready ·{' '}
              <span className="font-medium tabular-nums">{pointCount} pts</span>
            </span>
            <button
              onClick={clearDrawn}
              className="ml-auto text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </button>
          </div>
        )}

        {/* ── Save ──────────────────────────────────────────────────── */}
        <Button
          size="sm"
          className="w-full text-xs h-8"
          disabled={!drawnGeometry || status === 'saving'}
          onClick={() => void handleSave()}
        >
          {status === 'saving' ? 'Saving…' : 'Save to Map'}
        </Button>

        {/* ── Status feedback ───────────────────────────────────────── */}
        {status === 'success' && (
          <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
            <CheckCircle2 className="size-3.5" />
            Saved — layer updated on map
          </div>
        )}
        {status === 'error' && (
          <div className="flex items-start gap-1.5 text-xs text-destructive">
            <XCircle className="size-3.5 mt-0.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

      </div>
    </div>
  )
}
