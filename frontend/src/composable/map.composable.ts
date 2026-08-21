// Shared composables and utilities for all map-related pages
// (hazard, zoning, and the main /map view).

import { useCallback, useEffect, useRef, useState } from 'react'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import { simplify } from '@turf/turf'
import type { Polygon, MultiPolygon, Feature } from 'geojson'
import type { IControl } from 'maplibre-gl'
import type { MapEngine } from '@/engine/map.engine'
import { useQuery } from '@tanstack/react-query'
import { fetchClient } from '@/lib/api-client'
import type { ZoningAreaSummary } from '@/types/api-aliases'
import { useCityContext } from '@/context/city.context'

import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'

// ── Save helper ──────────────────────────────────────────────────────────────
// Shared try/catch + dispatch pattern for draw and upload saves in both
// hazard and zoning pages.

function extractApiErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'detail' in err) {
    const detail = (err as { detail?: unknown }).detail
    if (typeof detail === 'string') return detail
  }
  if (err instanceof Error) return err.message
  return String(err)
}

export async function saveWithDispatch(
  apiCall: () => Promise<void>,
  dispatch: (action: { type: 'SAVE_SUCCESS' } | { type: 'SAVE_ERROR'; errorMsg: string }) => void,
  onSuccess?: () => void,
): Promise<void> {
  try {
    await apiCall()
    dispatch({ type: 'SAVE_SUCCESS' })
    onSuccess?.()
  } catch (err) {
    dispatch({ type: 'SAVE_ERROR', errorMsg: extractApiErrorMessage(err) })
  }
}

// ── GeoJSON file utilities ────────────────────────────────────────────────────

export function extractPolygon(text: string): Polygon | null {
  try {
    const json = JSON.parse(text) as Record<string, unknown>
    if (json.type === 'Polygon') return json as unknown as Polygon
    if (json.type === 'Feature') {
      const geom = (json as { geometry?: { type?: string } }).geometry
      if (geom?.type === 'Polygon') return geom as unknown as Polygon
    }
    if (json.type === 'FeatureCollection') {
      const feat = (json as { features?: { geometry?: { type?: string } }[] }).features?.[0]
      if (feat?.geometry?.type === 'Polygon') return feat.geometry as unknown as Polygon
    }
    return null
  } catch { return null }
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = e => resolve(e.target?.result as string)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

// ── MapboxDraw styles (MapLibre-compatible) ───────────────────────────────────
// MapboxDraw v1.5 uses raw array literals inside `case` expressions for
// line-dasharray, which MapLibre GL rejects. This theme replaces those with
// `['literal', [...]]` wrapping so both libraries are happy.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MAPLIBRE_DRAW_STYLES: any[] = [
  { id: 'gl-draw-polygon-fill-inactive', type: 'fill',
    filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
    paint: { 'fill-color': '#3bb2d0', 'fill-outline-color': '#3bb2d0', 'fill-opacity': 0.1 } },
  { id: 'gl-draw-polygon-fill-active', type: 'fill',
    filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
    paint: { 'fill-color': '#fbb03b', 'fill-outline-color': '#fbb03b', 'fill-opacity': 0.1 } },
  { id: 'gl-draw-polygon-midpoint', type: 'circle',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']],
    paint: { 'circle-radius': 3, 'circle-color': '#fbb03b' } },
  { id: 'gl-draw-polygon-stroke-inactive', type: 'line',
    filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#3bb2d0', 'line-width': 2 } },
  { id: 'gl-draw-polygon-stroke-active', type: 'line',
    filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#fbb03b', 'line-dasharray': ['literal', [0.2, 2]], 'line-width': 2 } },
  { id: 'gl-draw-line-inactive', type: 'line',
    filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'LineString'], ['!=', 'mode', 'static']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#3bb2d0', 'line-width': 2 } },
  { id: 'gl-draw-line-active', type: 'line',
    filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'LineString']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#fbb03b', 'line-dasharray': ['literal', [0.2, 2]], 'line-width': 2 } },
  { id: 'gl-draw-polygon-and-line-vertex-stroke-inactive', type: 'circle',
    filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']],
    paint: { 'circle-radius': 5, 'circle-color': '#fff' } },
  { id: 'gl-draw-polygon-and-line-vertex-inactive', type: 'circle',
    filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']],
    paint: { 'circle-radius': 3, 'circle-color': '#fbb03b' } },
  { id: 'gl-draw-point-point-stroke-inactive', type: 'circle',
    filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Point'], ['==', 'meta', 'feature'], ['!=', 'mode', 'static']],
    paint: { 'circle-radius': 5, 'circle-color': '#fff' } },
  { id: 'gl-draw-point-inactive', type: 'circle',
    filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Point'], ['==', 'meta', 'feature'], ['!=', 'mode', 'static']],
    paint: { 'circle-radius': 3, 'circle-color': '#3bb2d0' } },
  { id: 'gl-draw-point-point-stroke-active', type: 'circle',
    filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Point'], ['==', 'meta', 'feature']],
    paint: { 'circle-radius': 7, 'circle-color': '#fff' } },
  { id: 'gl-draw-point-active', type: 'circle',
    filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Point'], ['==', 'meta', 'feature']],
    paint: { 'circle-radius': 5, 'circle-color': '#fbb03b' } },
  { id: 'gl-draw-polygon-fill-static', type: 'fill',
    filter: ['all', ['==', 'mode', 'static'], ['==', '$type', 'Polygon']],
    paint: { 'fill-color': '#404040', 'fill-outline-color': '#404040', 'fill-opacity': 0.1 } },
  { id: 'gl-draw-polygon-stroke-static', type: 'line',
    filter: ['all', ['==', 'mode', 'static'], ['==', '$type', 'Polygon']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#404040', 'line-width': 2 } },
  { id: 'gl-draw-line-static', type: 'line',
    filter: ['all', ['==', 'mode', 'static'], ['==', '$type', 'LineString']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#404040', 'line-width': 2 } },
  { id: 'gl-draw-point-static', type: 'circle',
    filter: ['all', ['==', 'mode', 'static'], ['==', '$type', 'Point']],
    paint: { 'circle-radius': 5, 'circle-color': '#404040' } },
]

// ── useDrawPolygon ────────────────────────────────────────────────────────────

export type DrawMode = 'draw_polygon' | 'draw_freehand'

export interface UseDrawPolygonResult {
  isActive:          boolean
  activeMode:        DrawMode | null
  drawnGeometry:     Polygon | null
  pointCount:        number
  activate:          (mode: DrawMode) => Promise<void>
  deactivate:        () => void
  clearDrawn:        () => void
  /** Read the current polygon from the draw control (reflects vertex edits made after drawing). */
  getLatestGeometry: () => Polygon | null
}

export function useDrawPolygon(
  engine: MapEngine | null,
  onComplete?: (geometry: Polygon, pointCount: number) => void,
): UseDrawPolygonResult {
  const drawRef       = useRef<InstanceType<typeof MapboxDraw> | null>(null)
  const cleanupRef    = useRef<(() => void) | null>(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const [isActive,      setIsActive]      = useState(false)
  const [activeMode,    setActiveMode]    = useState<DrawMode | null>(null)
  const [drawnGeometry, setDrawnGeometry] = useState<Polygon | null>(null)
  const [pointCount,    setPointCount]    = useState(0)

  const deactivate = useCallback(() => {
    if (!engine) return
    cleanupRef.current?.()
    cleanupRef.current = null
    if (drawRef.current) {
      try { engine.instance.removeControl(drawRef.current as unknown as IControl) } catch { /* already removed */ }
      drawRef.current = null
    }
    setIsActive(false)
    setActiveMode(null)
  }, [engine])

  const clearDrawn = useCallback(() => {
    setDrawnGeometry(null)
    setPointCount(0)
    drawRef.current?.deleteAll()
  }, [])

  const getLatestGeometry = useCallback((): Polygon | null => {
    const features = drawRef.current?.getAll().features ?? []
    if (!features.length) return null
    const geom = features[features.length - 1].geometry
    if (!geom) return null
    if (geom.type === 'Polygon') return geom as Polygon
    if (geom.type === 'MultiPolygon') {
      const outerRings = (geom as MultiPolygon).coordinates.map(p => p[0])
      const largest = outerRings.reduce((a, b) => (b.length > a.length ? b : a))
      return { type: 'Polygon', coordinates: [largest] }
    }
    return null
  }, [])

  const activate = useCallback(async (mode: DrawMode) => {
    if (!engine) return
    deactivate()
    setDrawnGeometry(null)
    setPointCount(0)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let freehandMode: any = undefined
    if (mode === 'draw_freehand') {
      const mod = await import('mapbox-gl-draw-freehand-mode')
      freehandMode = mod.default ?? mod
    }

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      styles: MAPLIBRE_DRAW_STYLES,
      ...(freehandMode ? { modes: { ...MapboxDraw.modes, draw_freehand: freehandMode } } : {}),
    })

    engine.instance.addControl(draw as unknown as IControl)
    draw.changeMode(mode as string)

    // Guard against draw.create + draw.modechange both firing for the same shape.
    const processed = { done: false }

    const processFeature = (feature: Feature | undefined) => {
      if (processed.done || !feature?.geometry) return

      let raw: Polygon
      if (feature.geometry.type === 'Polygon') {
        raw = feature.geometry as Polygon
      } else if (feature.geometry.type === 'MultiPolygon') {
        // Freehand can produce MultiPolygon for self-intersecting paths.
        const outerRings = (feature.geometry as MultiPolygon).coordinates.map(p => p[0])
        const largest = outerRings.reduce((a, b) => (b.length > a.length ? b : a))
        raw = { type: 'Polygon', coordinates: [largest] }
      } else {
        return
      }

      const tolerance = mode === 'draw_freehand' ? 0.00005 : 0.0001
      const simplified = simplify(
        { type: 'Feature', geometry: raw, properties: {} },
        { tolerance, highQuality: true, mutate: false },
      )
      const simplifiedPoly = simplified.geometry as Polygon
      // Fall back to raw ring if simplification degenerates the polygon.
      const poly: Polygon = simplifiedPoly.coordinates[0].length >= 4 ? simplifiedPoly : raw

      processed.done = true

      // Keep feature in MapboxDraw and enter direct_select so the user can
      // drag vertices to edit the shape before saving.
      try {
        draw.changeMode('direct_select', { featureId: String(feature.id ?? '') })
      } catch {
        draw.changeMode('simple_select' as string)
      }

      setDrawnGeometry(poly)
      setPointCount(poly.coordinates[0].length)
      onCompleteRef.current?.(poly, poly.coordinates[0].length)
    }

    // draw.create fires for click-to-place polygon mode.
    const handleCreate = (e: { features?: Feature[] }) => processFeature(e?.features?.[0])

    // draw.modechange fires when freehand-mode finishes and hands control back to
    // simple_select. mapbox-gl-draw-freehand-mode does NOT reliably fire draw.create,
    // so we read the completed feature directly from draw.getAll() here.
    const handleModeChange = (e: { mode: string }) => {
      if (e.mode !== 'simple_select' || processed.done) return
      const features = draw.getAll().features
      if (features.length) processFeature(features[features.length - 1] as Feature)
    }

    engine.instance.on('draw.create',    handleCreate    as never)
    engine.instance.on('draw.modechange', handleModeChange as never)

    cleanupRef.current = () => {
      engine.instance.off('draw.create',    handleCreate    as never)
      engine.instance.off('draw.modechange', handleModeChange as never)
    }

    drawRef.current = draw
    setIsActive(true)
    setActiveMode(mode)
  }, [engine, deactivate])

  useEffect(() => () => deactivate(), [deactivate])

  return { isActive, activeMode, drawnGeometry, pointCount, activate, deactivate, clearDrawn, getLatestGeometry }
}

// ── useZoningPanel ────────────────────────────────────────────────────────────

export interface ZoningScenarioGroup {
  /** null = zones with no scenario set */
  scenario:     string | null
  scenarioType: string | null
  zoneTypes:    [string, number][]              // [zone_type_key, count]
  zoneColors:   Record<string, string | null>   // zone_type_key → first color_hex seen
}

function buildZoneGroups(zones: ZoningAreaSummary[]): {
  zoneTypes:      [string, number][]
  zoneColors:     Record<string, string | null>
  scenarioGroups: ZoningScenarioGroup[]
} {
  // Flat aggregates (all zones combined)
  const flatGrouped: Record<string, number>          = {}
  const flatColors:  Record<string, string | null>   = {}

  // Per-scenario aggregates  (key = scenario ?? '__none__')
  const scenMap = new Map<string, { scenario: string | null; scenarioType: string | null; counts: Record<string, number>; colors: Record<string, string | null> }>()

  for (const z of zones) {
    const typeKey = z.zone_type ?? '(unlabelled)'
    flatGrouped[typeKey] = (flatGrouped[typeKey] ?? 0) + 1
    if (!(typeKey in flatColors)) flatColors[typeKey] = z.color_hex ?? null

    const scenKey = z.scenario ?? '__none__'
    if (!scenMap.has(scenKey)) {
      scenMap.set(scenKey, { scenario: z.scenario ?? null, scenarioType: z.scenario_type ?? null, counts: {}, colors: {} })
    }
    const entry = scenMap.get(scenKey)!
    entry.counts[typeKey] = (entry.counts[typeKey] ?? 0) + 1
    if (!(typeKey in entry.colors)) entry.colors[typeKey] = z.color_hex ?? null
  }

  const scenarioGroups: ZoningScenarioGroup[] = Array.from(scenMap.values()).map(({ scenario, scenarioType, counts, colors }) => ({
    scenario,
    scenarioType,
    zoneTypes:  Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)),
    zoneColors: colors,
  })).sort((a, b) => {
    // No-scenario group last
    if (a.scenario === null) return 1
    if (b.scenario === null) return -1
    return a.scenario.localeCompare(b.scenario)
  })

  return {
    zoneTypes:      Object.entries(flatGrouped).sort(([a], [b]) => a.localeCompare(b)),
    zoneColors:     flatColors,
    scenarioGroups,
  }
}

export function useZoningPanel() {
  const { selectedCity } = useCityContext()
  const cityId = selectedCity?.id ?? ''

  // retry: false — 404 is expected when the city has no zoning data yet
  const { data: pmtilesRes, isLoading: pmtilesLoading } = useQuery({
    queryKey: [`/cities/${cityId}/zoning/pmtiles`],
    queryFn:  () => fetchClient.GET('/cities/{city_id}/zoning/pmtiles', { params: { path: { city_id: cityId } } }),
    enabled:  !!cityId,
    retry:    false,
  })
  const pmtileUrl = pmtilesRes?.data?.pmtile_url ?? null

  const { data: zonesRes, isLoading: zonesLoading } = useQuery({
    queryKey: [`/cities/${cityId}/zoning`],
    queryFn:  () => fetchClient.GET('/cities/{city_id}/zoning', { params: { path: { city_id: cityId } } }),
    enabled:  !!cityId,
    retry:    false,
  })
  const zones: ZoningAreaSummary[] = zonesRes?.data ?? []
  const isLoading = pmtilesLoading || zonesLoading

  const { zoneTypes, zoneColors, scenarioGroups } = buildZoneGroups(zones)

  return { pmtileUrl, zones, zoneTypes, zoneColors, scenarioGroups, isLoading }
}
