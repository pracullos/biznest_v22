import { useEffect, useReducer, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import { ArrowLeft, PenLine, ScanText, Upload, X } from 'lucide-react'
import type { Polygon } from 'geojson'
import axios from 'axios'
import { Map } from '@/components/map'
import { MapContext, useMapContext } from '@/context/map.context'
import type { MapEngine } from '@/engine/map.engine'
import { useCityContext } from '@/context/city.context'
import { useDrawPolygon, saveWithDispatch } from '@/composable/map.composable'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { MapDrawPanel, mapSelectCls } from '@/components/map/map-draw-panel'
import { MapUploadPanel } from '@/components/map/map-upload-panel'
import { MapOcrPanel } from '@/components/map/map-ocr-panel'
import { type ScenarioType, type ZoneType, ZONING_DRAW_INITIAL, zoningDrawReducer } from '@/reducer/zoning-draw.reducer'
import { ZONING_UPLOAD_INITIAL, zoningUploadReducer } from '@/reducer/zoning-upload.reducer'
import { ZONE_TYPE_COLORS, ZONE_TYPE_LABELS } from '@/config/hazard.config'
import { useGeoreference } from './composables/use-georeference'
import { useQueryClient } from '@tanstack/react-query'

const ZONE_TYPES: ZoneType[] = ['residential', 'commercial', 'industrial', 'agriculture']

type ActivePanel = 'draw' | 'upload' | 'ocr' | null

const PANEL_BUTTONS: { id: NonNullable<ActivePanel>; icon: LucideIcon; label: string }[] = [
  { id: 'draw',   icon: PenLine,  label: 'Draw Zoning Area' },
  { id: 'upload', icon: Upload,   label: 'Upload GeoJSON' },
  { id: 'ocr',    icon: ScanText, label: 'OCR + Georeferencing' },
]

// ── Upload panel ──────────────────────────────────────────────────────────────

// ── Page ─────────────────────────────────────────────────────────────────────

export function ZoningPage() {
  const navigate     = useNavigate()
  const queryClient  = useQueryClient()

  const outerCtx = useMapContext()
  const { selectedCity, cityId, cityBoundary } = useCityContext()

  const [engine, setLocalEngine] = useState<MapEngine | null>(null)

  function handleSetEngine(eng: MapEngine | null) {
    setLocalEngine(eng)
  }

  const [drawState,   dispatchDraw]   = useReducer(zoningDrawReducer,   ZONING_DRAW_INITIAL)
  const [uploadState, dispatchUpload] = useReducer(zoningUploadReducer, ZONING_UPLOAD_INITIAL)
  const [activePanel, setActivePanel] = useState<ActivePanel>(null)

  const geo = useGeoreference(engine, cityId ?? null, cityBoundary ?? null, () => {
    void queryClient.invalidateQueries({ queryKey: [`/cities/${cityId}/zoning`] })
    void queryClient.invalidateQueries({ queryKey: [`/cities/${cityId}/zoning/pmtiles`] })
  })

  async function saveZoningGeometry(geometry: Polygon) {
    await saveWithDispatch(
        async () => {
          await axios.post(`/cities/${cityId}/zoning`, {
            city_id:       cityId,
            zone_type:     drawState.zoneType,
            color_hex:     ZONE_TYPE_COLORS[drawState.zoneType] ?? null,
            severity:      drawState.severity,
            scenario:      drawState.scenario || null,
            scenario_type: drawState.scenarioType || null,
            geometry,
          })
          await axios.post(`/cities/${cityId}/zoning/regenerate-pmtiles`)
        },
        dispatchDraw,
        () => draw.clearDrawn(),
    )
  }

  // ── Draw with callback — no bridge effect needed ──────────────────────────
  const draw = useDrawPolygon(engine, (geometry, pointCount) => {
    dispatchDraw({ type: 'SHAPE_DRAWN', geometry, pointCount })
  })

  useEffect(() => {
    if (!engine || !cityBoundary) return
    engine.flyToCityBoundary(cityBoundary)
    engine.setCityBoundary(cityBoundary)
  }, [engine, cityBoundary])

  function handleTogglePanel(panel: ActivePanel) {
    if (activePanel === panel) {
      if (panel === 'draw') draw.deactivate()
      if (panel === 'ocr') geo.reset()
      setActivePanel(null)
    } else {
      if (activePanel === 'draw') draw.deactivate()
      if (activePanel === 'ocr') geo.reset()
      setActivePanel(panel)
    }
  }

  function handleStartDrawing()  { dispatchDraw({ type: 'START_DRAWING' }); void draw.activate(drawState.drawMode) }
  function handleCancelDrawing() { dispatchDraw({ type: 'CANCEL_DRAWING' }); draw.deactivate() }

  async function handleDrawSave() {
    const geometry = draw.getLatestGeometry() ?? drawState.geometry
    if (!geometry || !cityId) return
    dispatchDraw({ type: 'SAVE_START' })
    await saveZoningGeometry(geometry)
  }

  async function handleUploadSave() {
    if (!uploadState.geometry || !cityId) return
    dispatchUpload({ type: 'SAVE_START' })
    await saveWithDispatch(
      async () => {
        await axios.post(`/cities/${cityId}/zoning`, {
          city_id:       cityId,
          zone_type:     uploadState.zoneType,
          color_hex:     ZONE_TYPE_COLORS[uploadState.zoneType] ?? null,
          severity:      uploadState.severity,
          scenario:      uploadState.scenario || null,
          scenario_type: uploadState.scenarioType || null,
          geometry:      uploadState.geometry,
        })
        await axios.post(`/cities/${cityId}/zoning/regenerate-pmtiles`)
      },
      dispatchUpload,
    )
  }

  const localCtx = {
    ...outerCtx,
    engine,
    setEngine: handleSetEngine,
    hazardLayers:        [] as typeof outerCtx.hazardLayers,
    visibleHazardKeys:   new Set<string>(),
    toggleHazard:        () => {},
    zoningPmtileUrl:     null,
    showZoning:          false,
    setShowZoning:       () => {},
    visibleZoningTypes:  null,
    toggleZoningType:    () => {},
    resetZoningTypes:    () => {},
    resetHazardVisibility: () => {},
    clickedZone:         null,
    setClickedZone:      () => {},
    refreshZoningLayer:  async () => {},
    refreshHazardLayers: async () => {},
  }

  return (
    <MapContext.Provider value={localCtx}>
      <div className="relative size-full">
        <Map className="size-full" center={[122.0, 12.0]} zoom={6} pitch={0} />

        {/* Back button */}
        <div className="absolute top-3 left-3 z-10 pointer-events-auto">
          <Button variant="secondary" size="sm"
            className="gap-1.5 shadow-lg bg-background/90 backdrop-blur-md border"
            onClick={() => { draw.deactivate(); void navigate({ to: '/map' as never }) }}>
            <ArrowLeft className="size-3.5" />
            Back to Map
            {selectedCity?.name && <span className="text-muted-foreground text-[11px]">· {selectedCity.name}</span>}
          </Button>
        </div>

        {/* Action controls */}
        <div className="absolute right-3 top-3 bottom-3 z-10 flex items-start gap-2 pointer-events-none">
          {activePanel && (
            <Card className="pointer-events-auto flex flex-col w-64 max-h-full shadow-2xl bg-background/95 backdrop-blur-md border-border/50 animate-in fade-in-0 slide-in-from-right-2 duration-150 overflow-hidden">
              <CardHeader className="pb-0 pt-3 px-3 shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-semibold">
                    {activePanel === 'draw' ? 'Draw Zoning Area'
                     : activePanel === 'upload' ? 'Upload GeoJSON'
                     : 'OCR + Georeferencing'}
                  </CardTitle>
                  <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground"
                    onClick={() => handleTogglePanel(activePanel)}>
                    <X className="size-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <Separator className="mt-2 shrink-0" />
              <CardContent className="flex flex-col flex-1 min-h-0 p-0">
                {activePanel === 'ocr' ? (
                  <MapOcrPanel
                    phase={geo.phase}
                    result={geo.result}
                    errorMsg={geo.errorMsg}
                    opacity={geo.opacity}
                    nColors={geo.nColors}
                    minAreaPx={geo.minAreaPx}
                    handleFile={geo.handleFile}
                    updateOpacity={geo.updateOpacity}
                    setNColors={geo.setNColors}
                    setMinAreaPx={geo.setMinAreaPx}
                    submit={geo.submit}
                    reset={() => { geo.reset(); setActivePanel(null) }}
                  />
                ) : activePanel === 'draw' ? (
                  <MapDrawPanel
                    phase={drawState.phase} drawMode={drawState.drawMode}
                    severity={drawState.severity} pointCount={drawState.pointCount}
                    geometry={drawState.geometry} errorMsg={drawState.errorMsg}
                    onSetDrawMode={m => dispatchDraw({ type: 'SET_DRAW_MODE', drawMode: m })}
                    onSetSeverity={s => dispatchDraw({ type: 'SET_SEVERITY', severity: s })}
                    onClearShape={() => dispatchDraw({ type: 'CLEAR_SHAPE' })}
                    onStartDrawing={handleStartDrawing}
                    onCancelDrawing={handleCancelDrawing}
                    onSave={handleDrawSave}
                    onDrawAnother={() => dispatchDraw({ type: 'DRAW_ANOTHER' })}
                  >
                    {(() => {
                      const locked = drawState.phase === 'drawing' || drawState.phase === 'saving'
                      return (
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Zone Type</label>
                            <div className="flex items-center gap-1.5">
                              <div
                                className="size-3.5 rounded-sm shrink-0 border border-white/20"
                                style={{ background: ZONE_TYPE_COLORS[drawState.zoneType] ?? '#888' }}
                              />
                              <select disabled={locked} value={drawState.zoneType}
                                onChange={e => dispatchDraw({ type: 'SET_ZONE_TYPE', zoneType: e.target.value as ZoneType })}
                                className={mapSelectCls}>
                                {ZONE_TYPES.map(t => <option key={t} value={t}>{ZONE_TYPE_LABELS[t] ?? t}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Scenario</label>
                            <input
                              type="text" disabled={locked}
                              value={drawState.scenario ?? ''}
                              onChange={e => dispatchDraw({ type: 'SET_SCENARIO', scenario: e.target.value || null })}
                              placeholder="e.g. 2024, 2025-06"
                              className={mapSelectCls}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Scenario Type</label>
                            <select disabled={locked} value={drawState.scenarioType ?? ''}
                              onChange={e => dispatchDraw({ type: 'SET_SCENARIO_TYPE', scenarioType: (e.target.value || null) as ScenarioType | null })}
                              className={mapSelectCls}>
                              <option value="">— none —</option>
                              <option value="year">Year</option>
                              <option value="month">Month</option>
                            </select>
                          </div>
                        </div>
                      )
                    })()}
                  </MapDrawPanel>
                ) : (
                  <MapUploadPanel
                    phase={uploadState.phase} fileName={uploadState.fileName}
                    severity={uploadState.severity} errorMsg={uploadState.errorMsg}
                    onFileReady={(fileName, geometry) => dispatchUpload({ type: 'SET_FILE', fileName, geometry })}
                    onFileClear={() => dispatchUpload({ type: 'CLEAR_FILE' })}
                    onSetSeverity={s => dispatchUpload({ type: 'SET_SEVERITY', severity: s })}
                    onSave={handleUploadSave}
                    onReset={() => dispatchUpload({ type: 'RESET' })}
                  >
                    {(() => {
                      const locked = uploadState.phase === 'saving'
                      return (
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Zone Type</label>
                            <div className="flex items-center gap-1.5">
                              <div
                                className="size-3.5 rounded-sm shrink-0 border border-white/20"
                                style={{ background: ZONE_TYPE_COLORS[uploadState.zoneType] ?? '#888' }}
                              />
                              <select disabled={locked} value={uploadState.zoneType}
                                onChange={e => dispatchUpload({ type: 'SET_ZONE_TYPE', zoneType: e.target.value as ZoneType })}
                                className={mapSelectCls}>
                                {ZONE_TYPES.map(t => <option key={t} value={t}>{ZONE_TYPE_LABELS[t] ?? t}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Scenario</label>
                            <input
                              type="text" disabled={locked}
                              value={uploadState.scenario ?? ''}
                              onChange={e => dispatchUpload({ type: 'SET_SCENARIO', scenario: e.target.value || null })}
                              placeholder="e.g. 2024, 2025-06"
                              className={mapSelectCls}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Scenario Type</label>
                            <select disabled={locked} value={uploadState.scenarioType ?? ''}
                              onChange={e => dispatchUpload({ type: 'SET_SCENARIO_TYPE', scenarioType: (e.target.value || null) as ScenarioType | null })}
                              className={mapSelectCls}>
                              <option value="">— none —</option>
                              <option value="year">Year</option>
                              <option value="month">Month</option>
                            </select>
                          </div>
                        </div>
                      )
                    })()}
                  </MapUploadPanel>
                )}
              </CardContent>
            </Card>
          )}

          <TooltipProvider delayDuration={400}>
            <div className="pointer-events-auto self-center flex flex-col gap-0.5 rounded-xl bg-black/65 backdrop-blur-md shadow-2xl p-1.5 border border-white/10">
              {PANEL_BUTTONS.map((btn, i) => {
                const Icon     = btn.icon
                const isActive = activePanel === btn.id
                return (
                  <div key={btn.id}>
                    {i > 0 && <Separator className="my-0.5 bg-white/10" />}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={btn.label}
                          onClick={() => handleTogglePanel(btn.id)}
                          className={cn(
                            'size-9 rounded-lg transition-all hover:bg-white/15 text-white/60 hover:text-white',
                            isActive && 'bg-white/20 text-white ring-1 ring-white/30',
                          )}>
                          <Icon className="size-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left" sideOffset={8}>{btn.label}</TooltipContent>
                    </Tooltip>
                  </div>
                )
              })}
            </div>
          </TooltipProvider>
        </div>
      </div>
    </MapContext.Provider>
  )
}
