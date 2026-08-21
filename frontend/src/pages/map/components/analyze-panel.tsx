import { useState, useEffect, useRef, useCallback } from 'react'
import {
  BrainCircuit, Loader2, MousePointerClick, PenLine,
  RotateCcw, AlertCircle, ChevronDown, ChevronUp, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useMapContext } from '@/context/map.context'
import { useCityContext } from '@/context/city.context'
import { useDrawPolygon } from '@/composable/map.composable'
import { $api } from '@/lib/api-client'
import type { LocationAnalyzeResponse } from '@/types/api-aliases'
import type { Polygon } from 'geojson'

type InputMode = 'point' | 'polygon'
type Phase = 'idle' | 'selecting' | 'ready' | 'analyzing' | 'done' | 'error'

const MARKER_ID = 'analyze-point-marker'

export function AnalyzePanel() {
  const { engine } = useMapContext()
  const { selectedCity } = useCityContext()

  const [phase, setPhase]               = useState<Phase>('idle')
  const [inputMode, setInputMode]       = useState<InputMode>('point')
  const [question, setQuestion]         = useState('')
  const [bufferMeters, setBufferMeters] = useState(500)
  const [pointCoords, setPointCoords]   = useState<[number, number] | null>(null)
  const [polyGeom, setPolyGeom]         = useState<Polygon | null>(null)
  const [result, setResult]             = useState<LocationAnalyzeResponse | null>(null)
  const [errorMsg, setErrorMsg]         = useState('')
  const [showContext, setShowContext]   = useState(false)

  const clickCleanupRef = useRef<(() => void) | null>(null)

  const draw = useDrawPolygon(engine, (geometry) => {
    setPolyGeom(geometry)
    // Do NOT call draw.deactivate() here — it nulls the MapboxDraw map ref while
    // clickOnVertex is still mid-execution, causing a "dragPan null" crash when
    // MapboxDraw tries to transition to simple_select mode internally.
    // The draw control stays visible (showing the completed polygon) until reset().
    setPhase('ready')
  })

  const { mutate } = $api.useMutation('post', '/cities/{city_id}/analyze/location', {
    onSuccess: (res) => {
      setResult(res)
      setPhase('done')
    },
    onError: (err) => {
      const detail = err && typeof err === 'object' && 'detail' in err
        ? (err as { detail?: string | { msg: string }[] }).detail
        : undefined
      const msg = Array.isArray(detail) ? detail.map((d) => d.msg).join('; ') : (detail ?? 'Analysis failed')
      setErrorMsg(String(msg))
      setPhase('error')
    },
  })

  // Override cursor to crosshair during point selection (runs after boundary handler)
  useEffect(() => {
    if (!engine || phase !== 'selecting' || inputMode !== 'point') return
    const canvas = engine.instance.getCanvas()
    const setCrosshair = () => { canvas.style.cursor = 'crosshair' }
    engine.instance.on('mousemove', setCrosshair)
    canvas.style.cursor = 'crosshair'
    return () => {
      engine.instance.off('mousemove', setCrosshair)
      canvas.style.cursor = ''
    }
  }, [engine, phase, inputMode])

  const cleanupSelection = useCallback(() => {
    clickCleanupRef.current?.()
    clickCleanupRef.current = null
    engine?.removeMarker(MARKER_ID)
    if (engine) engine.instance.getCanvas().style.cursor = ''
    draw.deactivate()
    draw.clearDrawn()
  }, [engine, draw])

  const reset = useCallback(() => {
    cleanupSelection()
    setPhase('idle')
    setPointCoords(null)
    setPolyGeom(null)
    setResult(null)
    setErrorMsg('')
    setShowContext(false)
    setQuestion('')
  }, [cleanupSelection])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clickCleanupRef.current?.()
      engine?.removeMarker(MARKER_ID)
      if (engine) engine.instance.getCanvas().style.cursor = ''
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startPointSelection = useCallback(() => {
    if (!engine) return
    cleanupSelection()
    setPolyGeom(null)
    setPointCoords(null)
    setPhase('selecting')

    const cleanup = engine.onClick((e) => {
      const { lng, lat } = e.lngLat
      cleanup()
      clickCleanupRef.current = null
      engine.addMarker(MARKER_ID, [lng, lat], { color: '#f97316' })
      setPointCoords([lng, lat])
      setPhase('ready')
    })
    clickCleanupRef.current = cleanup
  }, [engine, cleanupSelection])

  const startPolygonSelection = useCallback(() => {
    if (!engine) return
    cleanupSelection()
    setPointCoords(null)
    setPolyGeom(null)
    setPhase('selecting')
    void draw.activate('draw_polygon')
  }, [engine, draw, cleanupSelection])

  const handleModeSelect = useCallback((mode: InputMode) => {
    setInputMode(mode)
    if (mode === 'point') startPointSelection()
    else startPolygonSelection()
  }, [startPointSelection, startPolygonSelection])

  const handleAnalyze = useCallback(() => {
    if (!selectedCity?.id) return
    const geometry = inputMode === 'point' && pointCoords
      ? { type: 'Point' as const, coordinates: pointCoords }
      : polyGeom
    if (!geometry) return
    setPhase('analyzing')
    mutate({
      params: { path: { city_id: selectedCity.id } },
      body: {
        geometry: geometry as { [key: string]: unknown },
        question: question.trim() || null,
        buffer_meters: bufferMeters,
      },
    })
  }, [selectedCity, inputMode, pointCoords, polyGeom, question, bufferMeters, mutate])

  // ── Phase: idle ───────────────────────────────────────────────────────────

  if (phase === 'idle') {
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-3 px-4 py-6 text-center">
        <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
          <BrainCircuit className="size-5 text-primary" />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium">Location Intelligence</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Pin a point or draw a polygon on the map to get an AI business analysis for that location.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => handleModeSelect('point')}>
            <MousePointerClick className="size-3.5" /> Click Point
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => handleModeSelect('polygon')}>
            <PenLine className="size-3.5" /> Draw Area
          </Button>
        </div>
      </div>
    )
  }

  // ── Phase: selecting ──────────────────────────────────────────────────────

  if (phase === 'selecting') {
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-3 px-4 text-center">
        <div className="size-9 rounded-full border-2 border-primary/50 border-dashed flex items-center justify-center animate-pulse">
          {inputMode === 'point'
            ? <MousePointerClick className="size-4 text-primary" />
            : <PenLine className="size-4 text-primary" />}
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium">
            {inputMode === 'point' ? 'Click on the map' : 'Draw a polygon'}
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {inputMode === 'point'
              ? 'Tap anywhere inside the city to pin the analysis point'
              : 'Click to place vertices — double-click or close the shape to finish'}
          </p>
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={reset}>
          Cancel
        </Button>
      </div>
    )
  }

  // ── Phase: ready ──────────────────────────────────────────────────────────

  if (phase === 'ready') {
    const coordLabel = inputMode === 'point' && pointCoords
      ? `${pointCoords[1].toFixed(5)}°N, ${pointCoords[0].toFixed(5)}°E`
      : 'Polygon area selected'

    return (
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-3 py-3 space-y-3">
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-[11px] font-mono leading-relaxed">
            {coordLabel}
            {inputMode === 'point' && (
              <span className="ml-1 font-sans text-muted-foreground">±{bufferMeters}m</span>
            )}
          </div>

          {inputMode === 'point' && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Search radius</span>
                <span>{bufferMeters} m</span>
              </div>
              <input
                type="range" min={100} max={2000} step={100}
                value={bufferMeters}
                onChange={(e) => setBufferMeters(Number(e.target.value))}
                className="w-full h-1.5 accent-primary cursor-pointer"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] text-muted-foreground">
              Custom question <span className="opacity-60">(optional)</span>
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. What retail businesses would work here?"
              rows={2}
              className={cn(
                'w-full rounded-md bg-muted/50 border border-border/50 px-2.5 py-1.5 text-xs resize-none outline-none',
                'focus:border-border transition-colors placeholder:text-muted-foreground/50',
              )}
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 shrink-0" onClick={reset}>
              <RotateCcw className="size-3" /> Redo
            </Button>
            <Button size="sm" className="h-8 text-xs gap-1.5 flex-1" onClick={handleAnalyze}>
              <BrainCircuit className="size-3.5" /> Analyze
            </Button>
          </div>
        </div>
      </ScrollArea>
    )
  }

  // ── Phase: analyzing ──────────────────────────────────────────────────────

  if (phase === 'analyzing') {
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin text-primary" />
        <p className="text-xs">Analyzing location…</p>
        <p className="text-[10px] text-muted-foreground/60">Querying spatial data and PSA classifications</p>
      </div>
    )
  }

  // ── Phase: error ──────────────────────────────────────────────────────────

  if (phase === 'error') {
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-3 px-4 text-center">
        <AlertCircle className="size-6 text-destructive" />
        <p className="text-xs text-destructive leading-relaxed">{errorMsg}</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={reset}>
            New Analysis
          </Button>
          <Button size="sm" className="h-7 text-xs" onClick={handleAnalyze}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  // ── Phase: done ───────────────────────────────────────────────────────────

  if (!result) return null

  const ctx = result.context
  const zoneCount  = ctx.zoning.reduce((s, z) => s + z.count, 0)
  const hazardCount = ctx.hazards.length
  const estabCount  = ctx.nearby_establishments.reduce((s, e) => s + e.count, 0)

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Summary chips */}
      <div className="px-3 pt-2 pb-1.5 shrink-0 flex flex-wrap gap-1">
        {ctx.zoning.slice(0, 3).map((z) => (
          <span key={z.zone_type ?? 'unlabelled'} className="text-[10px] rounded-full bg-blue-500/15 text-blue-400 px-2 py-0.5 leading-none">
            {z.zone_type ?? 'unlabelled'} ×{z.count}
          </span>
        ))}
        {ctx.hazards.slice(0, 2).map((h) => (
          <span key={h.hazard_type} className="text-[10px] rounded-full bg-red-500/15 text-red-400 px-2 py-0.5 leading-none">
            {h.hazard_type}
          </span>
        ))}
        {estabCount > 0 && (
          <span className="text-[10px] rounded-full bg-green-500/15 text-green-400 px-2 py-0.5 leading-none">
            {estabCount} nearby
          </span>
        )}
      </div>

      <Separator className="shrink-0" />

      <ScrollArea className="flex-1 min-h-0">
        <div className="px-3 py-3 space-y-3">
          {/* AI answer */}
          <div className="flex items-start gap-2">
            <div className="size-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="size-2.5 text-primary" />
            </div>
            <p className="text-[11px] leading-relaxed whitespace-pre-wrap">{result.answer}</p>
          </div>

          {/* Collapsible context */}
          <div>
            <button
              onClick={() => setShowContext((v) => !v)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {showContext ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
              Data context — {zoneCount} zone{zoneCount !== 1 ? 's' : ''} · {hazardCount} hazard type{hazardCount !== 1 ? 's' : ''} · {estabCount} establishment{estabCount !== 1 ? 's' : ''}
            </button>

            {showContext && (
              <div className="mt-2 rounded-lg bg-muted/40 px-2.5 py-2.5 space-y-2.5 text-[10px]">
                {ctx.zoning.length > 0 && (
                  <div className="space-y-1">
                    <p className="font-medium text-muted-foreground uppercase tracking-wide text-[9px]">Zoning</p>
                    {ctx.zoning.map((z) => (
                      <div key={z.zone_type ?? 'unlabelled'} className="flex justify-between gap-2">
                        <span className="truncate">{z.zone_type ?? '(unlabelled)'}</span>
                        <span className="text-muted-foreground shrink-0">
                          ×{z.count}{z.avg_severity != null ? ` · sev ${z.avg_severity.toFixed(1)}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {ctx.hazards.length > 0 && (
                  <div className="space-y-1">
                    <p className="font-medium text-muted-foreground uppercase tracking-wide text-[9px]">Hazards</p>
                    {ctx.hazards.map((h) => (
                      <div key={h.hazard_type} className="flex justify-between gap-2">
                        <span className="truncate">
                          {h.hazard_type}{h.scenarios.length > 0 ? ` (${h.scenarios.join(', ')})` : ''}
                        </span>
                        {h.avg_severity != null && (
                          <span className="text-muted-foreground shrink-0">sev {h.avg_severity.toFixed(1)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {ctx.nearby_establishments.length > 0 && (
                  <div className="space-y-1">
                    <p className="font-medium text-muted-foreground uppercase tracking-wide text-[9px]">Nearby</p>
                    {ctx.nearby_establishments.map((e) => (
                      <div key={e.category ?? 'uncategorized'} className="flex justify-between gap-2">
                        <span className="truncate">{e.category ?? 'uncategorized'}</span>
                        <span className="text-muted-foreground shrink-0">×{e.count}</span>
                      </div>
                    ))}
                  </div>
                )}

                {Object.keys(ctx.psa_classifications).length > 0 && (
                  <div className="space-y-1">
                    <p className="font-medium text-muted-foreground uppercase tracking-wide text-[9px]">PSA Classifications</p>
                    {Object.entries(ctx.psa_classifications).map(([sys, entries]) => (
                      <div key={sys} className="flex justify-between gap-2">
                        <span className="uppercase">{sys}</span>
                        <span className="text-muted-foreground shrink-0">{entries.length} categories</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      <Separator className="shrink-0" />
      <div className="px-3 py-2 shrink-0">
        <Button size="sm" variant="outline" className="w-full h-7 text-xs gap-1.5" onClick={reset}>
          <RotateCcw className="size-3" /> New Analysis
        </Button>
      </div>
    </div>
  )
}
