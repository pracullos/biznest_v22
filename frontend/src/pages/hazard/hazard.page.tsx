import { useReducer, useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, PenLine, ScanText, Upload, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
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
import {
  hazardDrawReducer,
  HAZARD_DRAW_INITIAL,
  type HazardType,
} from '@/reducer/hazard-draw.reducer'
import {
  hazardUploadReducer,
  HAZARD_UPLOAD_INITIAL,
} from '@/reducer/hazard-upload.reducer'
import {
  HAZARD_SCENARIO_PRESETS,
  HAZARD_TYPE_LABELS,
  SCENARIO_LABELS,
  getDefaultScenario,
} from '@/config/hazard.config'

const HAZARD_TYPES: HazardType[] = ['flood', 'landslide', 'storm_surge', 'debris_flow', 'faultline']

const inputCls =
  'w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs ' +
  'focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 placeholder:text-muted-foreground'

type ActivePanel = 'draw' | 'upload' | null

const PANEL_BUTTONS: { id: NonNullable<ActivePanel>; icon: LucideIcon; label: string }[] = [
  { id: 'draw',   icon: PenLine, label: 'Draw Hazard Area' },
  { id: 'upload', icon: Upload,  label: 'Upload GeoJSON' },
]

// ── Page ─────────────────────────────────────────────────────────────────────

export function HazardPage() {
  const navigate = useNavigate()

  // Read outer context for visual prefs only — NOT used to register with MapProvider
  const outerCtx = useMapContext()
  const { selectedCity, cityId, cityBoundary } = useCityContext()

  // Local engine state — isolated from the outer MapProvider
  const [engine, setLocalEngine] = useState<MapEngine | null>(null)
  const engineRef = useRef<MapEngine | null>(null)

  function handleSetEngine(eng: MapEngine | null) {
    engineRef.current = eng
    setLocalEngine(eng)
  }

  const [drawState,   dispatchDraw]   = useReducer(hazardDrawReducer,   HAZARD_DRAW_INITIAL)
  const [uploadState, dispatchUpload] = useReducer(hazardUploadReducer, HAZARD_UPLOAD_INITIAL)
  const [activePanel, setActivePanel] = useState<ActivePanel>(null)

  // ── Draw with callback — no bridge effect needed ──────────────────────────
  const draw = useDrawPolygon(engine, (geometry, pointCount) => {
    dispatchDraw({ type: 'SHAPE_DRAWN', geometry, pointCount })
  })

  // ── City boundary ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!engine || !cityBoundary) return
    engine.flyToCityBoundary(cityBoundary)
    engine.setCityBoundary(cityBoundary)
  }, [engine, cityBoundary])

  function handleTogglePanel(panel: ActivePanel) {
    if (activePanel === panel) { if (panel === 'draw') draw.deactivate(); setActivePanel(null) }
    else { if (activePanel === 'draw') draw.deactivate(); setActivePanel(panel) }
  }

  function handleStartDrawing()  { dispatchDraw({ type: 'START_DRAWING' }); void draw.activate(drawState.drawMode) }
  function handleCancelDrawing() { dispatchDraw({ type: 'CANCEL_DRAWING' }); draw.deactivate() }

  async function saveHazardGeometry(geometry: Polygon) {
    await saveWithDispatch(
      async () => {
        await axios.post(`/cities/${cityId}/hazards`, {
          hazard_type: drawState.hazardType, scenario: drawState.scenario,
          severity: drawState.severity, geometry,
        })
        const params = new URLSearchParams({ hazard_type: drawState.hazardType, scenario: drawState.scenario })
        await axios.post(`/cities/${cityId}/hazards/regenerate-pmtiles?${params}`)
      },
      dispatchDraw,
      () => draw.clearDrawn(),
    )
  }

  async function handleDrawSave() {
    const geometry = draw.getLatestGeometry() ?? drawState.geometry
    if (!geometry || !cityId) return
    dispatchDraw({ type: 'SAVE_START' })
    await saveHazardGeometry(geometry)
  }

  async function handleUploadSave() {
    if (!uploadState.geometry || !cityId) return
    dispatchUpload({ type: 'SAVE_START' })
    await saveWithDispatch(
      async () => {
        await axios.post(`/cities/${cityId}/hazards`, {
          hazard_type: uploadState.hazardType, scenario: uploadState.scenario,
          severity: uploadState.severity, geometry: uploadState.geometry,
        })
        const params = new URLSearchParams({ hazard_type: uploadState.hazardType, scenario: uploadState.scenario })
        await axios.post(`/cities/${cityId}/hazards/regenerate-pmtiles?${params}`)
      },
      dispatchUpload,
    )
  }

  // Local MapContext — intercepts setEngine so the outer MapProvider stays clean
  const localCtx = {
    ...outerCtx,
    engine,
    setEngine: handleSetEngine,
    // Stub everything that would trigger MapProvider side-effects
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
    // MapContext.Provider intercepts setEngine — the Map component works normally
    // without polluting the outer MapProvider.
    <MapContext.Provider value={localCtx}>
      <div className="relative size-full">
        {/* Map fills the container via size-full (same as the main /map page) */}
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
                    {activePanel === 'draw' ? 'Draw Hazard Area' : 'Upload GeoJSON'}
                  </CardTitle>
                  <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground"
                    onClick={() => handleTogglePanel(activePanel)}>
                    <X className="size-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <Separator className="mt-2 shrink-0" />
              <CardContent className="flex flex-col flex-1 min-h-0 p-0">
                {activePanel === 'draw' ? (
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
                      const presets = HAZARD_SCENARIO_PRESETS[drawState.hazardType]
                      const isCustom = presets !== null && drawState.scenario !== null && !presets.includes(drawState.scenario)
                      return (
                        <>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Hazard Type</label>
                            <select disabled={locked} value={drawState.hazardType}
                              onChange={e => {
                                const ht = e.target.value as HazardType
                                dispatchDraw({ type: 'SET_HAZARD_TYPE', hazardType: ht })
                                dispatchDraw({ type: 'SET_SCENARIO', scenario: getDefaultScenario(ht) })
                              }}
                              className={mapSelectCls}>
                              {HAZARD_TYPES.map(t => <option key={t} value={t}>{HAZARD_TYPE_LABELS[t]}</option>)}
                            </select>
                          </div>
                          {presets !== null && (
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Scenario</label>
                              <select disabled={locked}
                                value={isCustom ? '__other__' : (drawState.scenario ?? presets[0])}
                                onChange={e => {
                                  if (e.target.value === '__other__') {
                                    dispatchDraw({ type: 'SET_SCENARIO', scenario: '' })
                                  } else {
                                    dispatchDraw({ type: 'SET_SCENARIO', scenario: e.target.value })
                                  }
                                }}
                                className={mapSelectCls}>
                                {presets.map(s => <option key={s} value={s}>{SCENARIO_LABELS[s] ?? s}</option>)}
                                <option value="__other__">Other…</option>
                              </select>
                              {isCustom && (
                                <input type="text" disabled={locked} placeholder="e.g. 50yr"
                                  value={drawState.scenario ?? ''}
                                  onChange={e => dispatchDraw({ type: 'SET_SCENARIO', scenario: e.target.value || null })}
                                  className={inputCls} />
                              )}
                            </div>
                          )}
                        </>
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
                      const presets = HAZARD_SCENARIO_PRESETS[uploadState.hazardType]
                      const isCustom = presets !== null && uploadState.scenario !== null && !presets.includes(uploadState.scenario)
                      return (
                        <>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Hazard Type</label>
                            <select disabled={locked} value={uploadState.hazardType}
                              onChange={e => {
                                const ht = e.target.value as HazardType
                                dispatchUpload({ type: 'SET_HAZARD_TYPE', hazardType: ht })
                                dispatchUpload({ type: 'SET_SCENARIO', scenario: getDefaultScenario(ht) })
                              }}
                              className={mapSelectCls}>
                              {HAZARD_TYPES.map(t => <option key={t} value={t}>{HAZARD_TYPE_LABELS[t]}</option>)}
                            </select>
                          </div>
                          {presets !== null && (
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Scenario</label>
                              <select disabled={locked}
                                value={isCustom ? '__other__' : (uploadState.scenario ?? presets[0])}
                                onChange={e => {
                                  if (e.target.value === '__other__') {
                                    dispatchUpload({ type: 'SET_SCENARIO', scenario: '' })
                                  } else {
                                    dispatchUpload({ type: 'SET_SCENARIO', scenario: e.target.value })
                                  }
                                }}
                                className={mapSelectCls}>
                                {presets.map(s => <option key={s} value={s}>{SCENARIO_LABELS[s] ?? s}</option>)}
                                <option value="__other__">Other…</option>
                              </select>
                              {isCustom && (
                                <input type="text" disabled={locked} placeholder="e.g. 50yr"
                                  value={uploadState.scenario ?? ''}
                                  onChange={e => dispatchUpload({ type: 'SET_SCENARIO', scenario: e.target.value || null })}
                                  className={inputCls} />
                              )}
                            </div>
                          )}
                        </>
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
                const Icon = btn.icon
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
              <div>
                <Separator className="my-0.5 bg-white/10" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" disabled aria-label="OCR + Georeferencing"
                      className="size-9 rounded-lg text-white/30 disabled:pointer-events-auto cursor-not-allowed">
                      <ScanText className="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" sideOffset={8}>OCR + Georeferencing — coming soon</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </TooltipProvider>
        </div>
      </div>
    </MapContext.Provider>
  )
}
