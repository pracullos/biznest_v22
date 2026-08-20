import maplibregl from 'maplibre-gl'
import { bbox as turfBbox, bboxPolygon, booleanPointInPolygon, centroid as turfCentroid, difference, featureCollection, point as turfPoint } from '@turf/turf'
import type { LightPreset } from '@/context/map.context'

type GeoJsonData = Parameters<maplibregl.GeoJSONSource['setData']>[0]

export type BoundaryGeometry = {
  type: 'Polygon'
  coordinates: number[][][]
} | {
  type: 'MultiPolygon'
  coordinates: number[][][][]
}

export interface HazardTile {
  hazard_type: string
  scenario: string | null
  pmtile_url: string
  /** Source layer name read from the PMTile metadata — populated by MapProvider. */
  source_layer?: string
}

/** Four corner coordinates in [lng, lat] order: top-left, top-right, bottom-right, bottom-left. */
export type ImageCorners = [[number, number], [number, number], [number, number], [number, number]]

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY as string

// Register PMTiles protocol once at module load.
// Requires: pnpm add pmtiles
let pmtilesRegistered = false
async function ensurePmtilesProtocol() {
  if (pmtilesRegistered) return
  const { Protocol } = await import('pmtiles')
  const protocol = new Protocol()
  maplibregl.addProtocol('pmtiles', protocol.tile.bind(protocol))
  pmtilesRegistered = true
}
ensurePmtilesProtocol()

const LIGHT_PRESETS: Record<LightPreset, maplibregl.LightSpecification> = {
  dawn:  { anchor: 'viewport', color: '#ffaa55', intensity: 0.45 },
  day:   { anchor: 'viewport', color: 'white',   intensity: 0.4  },
  dusk:  { anchor: 'viewport', color: '#ff7733', intensity: 0.35 },
  night: { anchor: 'viewport', color: '#001a33', intensity: 0.6  },
}

const CITY_BOUND_SOURCE   = 'city-boundary'
const CITY_BOUND_LAYER    = 'city-boundary-outline'
const CITY_OVERLAY_SOURCE = 'city-overlay'
const CITY_OVERLAY_LAYER  = 'city-overlay-fill'

const ZONING_SOURCE = 'zoning-src'
const ZONING_FILL   = 'zoning-fill'
const ZONING_LINE   = 'zoning-line'

// Tippecanoe source-layer names baked into each PMTile.
// NOAH hazards: seeded from "slice.geojson" → layer = "slice".
// Faultlines:   seeded from "faultline.geojson" → layer = "faultline".
const HAZARD_SOURCE_LAYER: Record<string, string> = { faultline: 'faultline' }
const DEFAULT_HAZARD_SOURCE_LAYER = 'slice'

const HAZARD_COLORS: Record<string, string> = {
  flood:       '#3b82f6',
  landslide:   '#f97316',
  storm_surge: '#8b5cf6',
  debris_flow: '#a16207',
  faultline:   '#ef4444',
}

export class MapEngine {
  private readonly _map: maplibregl.Map
  private readonly _markers = new Map<string, maplibregl.Marker>()
  private readonly _popups = new Map<string, maplibregl.Popup>()
  private _cityBoundary: BoundaryGeometry | null = null
  private _boundaryMouseHandler: ((e: maplibregl.MapMouseEvent) => void) | null = null
  private readonly _hazardKeys = new Set<string>()
  private readonly _imageOverlayIds = new Set<string>()
  private _destroyed = false
  private _zoneClickListeners: {
    click: (e: maplibregl.MapLayerMouseEvent) => void
    enter: () => void
    leave: () => void
  } | null = null

  constructor(map: maplibregl.Map) {
    this._map = map
  }

  get instance(): maplibregl.Map {
    return this._map
  }

  // ── Camera ───────────────────────────────────────────────────────────────────

  flyTo(options: maplibregl.FlyToOptions): this {
    this._map.flyTo(options)
    return this
  }

  fitBounds(bounds: maplibregl.LngLatBoundsLike, options?: maplibregl.FitBoundsOptions): this {
    this._map.fitBounds(bounds, options)
    return this
  }

  jumpTo(options: maplibregl.JumpToOptions): this {
    this._map.jumpTo(options)
    return this
  }

  easeTo(options: maplibregl.EaseToOptions): this {
    this._map.easeTo(options)
    return this
  }

  // ── Sources ──────────────────────────────────────────────────────────────────

  addGeoJsonSource(id: string, data: GeoJsonData): this {
    if (!this._map.getSource(id)) {
      this._map.addSource(id, { type: 'geojson', data })
    }
    return this
  }

  /** Add a PMTiles vector source. url = path/URL to the .pmtiles file (no protocol prefix). */
  addPmtilesSource(id: string, url: string): this {
    if (!this._map.getSource(id)) {
      this._map.addSource(id, { type: 'vector', url: `pmtiles://${url}` })
    }
    return this
  }

  updateGeoJsonSource(id: string, data: GeoJsonData): this {
    const source = this._map.getSource(id) as maplibregl.GeoJSONSource | undefined
    source?.setData(data)
    return this
  }

  removeSource(id: string): this {
    if (this._map.getSource(id)) {
      this._map.removeSource(id)
    }
    return this
  }

  hasSource(id: string): boolean {
    return !!this._map.getSource(id)
  }

  // ── Layers ───────────────────────────────────────────────────────────────────

  addLayer(layer: maplibregl.LayerSpecification, beforeId?: string): this {
    if (!this._map.getLayer(layer.id)) {
      this._map.addLayer(layer, beforeId)
    }
    return this
  }

  removeLayer(id: string): this {
    if (this._map.getLayer(id)) {
      this._map.removeLayer(id)
    }
    return this
  }

  hasLayer(id: string): boolean {
    return !!this._map.getLayer(id)
  }

  setLayerVisibility(id: string, visible: boolean): this {
    if (this._map.getLayer(id)) {
      this._map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
    }
    return this
  }

  setPaintProperty(layerId: string, name: string, value: unknown): this {
    if (this._map.getLayer(layerId)) {
      this._map.setPaintProperty(layerId, name, value)
    }
    return this
  }

  setLayoutProperty(layerId: string, name: string, value: unknown): this {
    if (this._map.getLayer(layerId)) {
      this._map.setLayoutProperty(layerId, name, value)
    }
    return this
  }

  setFilter(layerId: string, filter: maplibregl.FilterSpecification | null | undefined): this {
    if (this._map.getLayer(layerId)) {
      this._map.setFilter(layerId, filter)
    }
    return this
  }

  // ── Markers ──────────────────────────────────────────────────────────────────

  addMarker(id: string, lngLat: maplibregl.LngLatLike, options?: maplibregl.MarkerOptions): maplibregl.Marker | null {
    const { lng, lat } = maplibregl.LngLat.convert(lngLat)
    if (!this.isInsideBoundary(lng, lat)) return null
    this.removeMarker(id)
    const marker = new maplibregl.Marker(options).setLngLat(lngLat).addTo(this._map)
    this._markers.set(id, marker)
    return marker
  }

  getMarker(id: string): maplibregl.Marker | undefined {
    return this._markers.get(id)
  }

  removeMarker(id: string): this {
    this._markers.get(id)?.remove()
    this._markers.delete(id)
    return this
  }

  clearMarkers(): this {
    this._markers.forEach(m => m.remove())
    this._markers.clear()
    return this
  }

  // ── Popups ───────────────────────────────────────────────────────────────────

  addPopup(id: string, lngLat: maplibregl.LngLatLike, html: string, options?: maplibregl.PopupOptions): maplibregl.Popup {
    this.removePopup(id)
    const popup = new maplibregl.Popup(options).setLngLat(lngLat).setHTML(html).addTo(this._map)
    this._popups.set(id, popup)
    return popup
  }

  removePopup(id: string): this {
    this._popups.get(id)?.remove()
    this._popups.delete(id)
    return this
  }

  clearPopups(): this {
    this._popups.forEach(p => p.remove())
    this._popups.clear()
    return this
  }

  // ── Events ───────────────────────────────────────────────────────────────────

  onClick(callback: (e: maplibregl.MapMouseEvent) => void): () => void {
    this._map.on('click', callback)
    return () => this._map.off('click', callback)
  }

  onLayerClick(
    layerId: string,
    callback: (features: maplibregl.MapGeoJSONFeature[], e: maplibregl.MapMouseEvent) => void,
  ): () => void {
    const handler = (e: maplibregl.MapMouseEvent) => {
      const features = this._map.queryRenderedFeatures(e.point, { layers: [layerId] })
      if (features.length) callback(features, e)
    }
    this._map.on('click', layerId, handler)
    return () => this._map.off('click', layerId, handler)
  }

  onHover(
    layerId: string,
    onEnter: (e: maplibregl.MapMouseEvent) => void,
    onLeave: (e: maplibregl.MapMouseEvent) => void,
  ): () => void {
    this._map.on('mouseenter', layerId, onEnter)
    this._map.on('mouseleave', layerId, onLeave)
    return () => {
      this._map.off('mouseenter', layerId, onEnter)
      this._map.off('mouseleave', layerId, onLeave)
    }
  }

  onMoveEnd(callback: (e: maplibregl.MapLibreEvent) => void): () => void {
    this._map.on('moveend', callback)
    return () => this._map.off('moveend', callback)
  }

  // ── Query ────────────────────────────────────────────────────────────────────

  queryFeatures(point: maplibregl.PointLike, layerIds?: string[]): maplibregl.MapGeoJSONFeature[] {
    return this._map.queryRenderedFeatures(point, layerIds ? { layers: layerIds } : undefined)
  }

  // ── Cursor ───────────────────────────────────────────────────────────────────

  setCursor(cursor: string): this {
    this._map.getCanvas().style.cursor = cursor
    return this
  }

  // ── Style / terrain ──────────────────────────────────────────────────────────

  setLightPreset(preset: LightPreset): this {
    if (this._map.isStyleLoaded()) {
      this._map.setLight(LIGHT_PRESETS[preset])
    }
    return this
  }

  setTerrain(enabled: boolean): this {
    if (!this._map.isStyleLoaded()) return this
    if (enabled) {
      if (!this._map.getSource('terrain-dem')) {
        this._map.addSource('terrain-dem', {
          type: 'raster-dem',
          url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${MAPTILER_KEY}`,
          tileSize: 256,
        })
      }
      this._map.setTerrain({ source: 'terrain-dem', exaggeration: 1.5 })
    } else {
      this._map.setTerrain(null)
    }
    return this
  }

  // ── City boundary ─────────────────────────────────────────────────────────────

  /**
   * Fly the map to fit the city boundary with padding.
   */
  flyToCityBoundary(boundary: BoundaryGeometry): this {
    if (this._destroyed) return this
    if (!this._map.isStyleLoaded()) {
      this._map.once('idle', () => this.flyToCityBoundary(boundary))
      return this
    }
    this._map.resize()
    const [w, s, e, n] = this._bbox(boundary)
    // maxZoom: 16 ≈ 1 km ground scale at typical viewport width
    this._map.fitBounds([[w, s], [e, n]], { padding: 60, maxZoom: 16, duration: 1200 })
    return this
  }

  /**
   * Renders a dark overlay outside the city boundary, a blue outline on the boundary edge,
   * and changes the cursor to `not-allowed` when the pointer leaves the boundary.
   * Also restricts `isInsideBoundary` checks to this geometry.
   */
  setCityBoundary(boundary: BoundaryGeometry): this {
    if (this._destroyed) return this
    if (!this._map.isStyleLoaded()) {
      this._map.once('idle', () => this.setCityBoundary(boundary))
      return this
    }

    this.clearCityBoundary()
    this._cityBoundary = boundary

    // Dark overlay covering the area outside the city boundary (non-critical — boundary renders regardless)
    try {
      const outside = this._outsideOverlayGeometry(boundary)
      if (outside) {
        this._map.addSource(CITY_OVERLAY_SOURCE, { type: 'geojson', data: outside })
        this._map.addLayer({
          id: CITY_OVERLAY_LAYER,
          type: 'fill',
          source: CITY_OVERLAY_SOURCE,
          paint: { 'fill-color': '#000000', 'fill-opacity': 0.35 },
        })
      }
    } catch { /* overlay is visual-only; never block the boundary outline */ }

    // Boundary outline on top of the overlay
    this._map.addSource(CITY_BOUND_SOURCE, {
      type: 'geojson',
      data: { type: 'Feature', geometry: boundary as never, properties: {} },
    })
    this._map.addLayer({
      id: CITY_BOUND_LAYER,
      type: 'line',
      source: CITY_BOUND_SOURCE,
      paint: {
        'line-color': '#3b82f6',
        'line-width': 2,
        'line-opacity': 0.85,
        'line-dasharray': [3, 1.5],
      },
    })

    // Cursor: not-allowed when pointer is outside the city boundary
    this._boundaryMouseHandler = (e: maplibregl.MapMouseEvent) => {
      const inside = this.isInsideBoundary(e.lngLat.lng, e.lngLat.lat)
      this._map.getCanvas().style.cursor = inside ? '' : 'not-allowed'
    }
    this._map.on('mousemove', this._boundaryMouseHandler)

    this._restrictViewToBoundary(boundary)

    return this
  }

  /**
   * Removes the city boundary overlay, outline, cursor restriction, and pan restriction.
   */
  clearCityBoundary(): this {
    this.removeLayer(CITY_OVERLAY_LAYER)
    this.removeSource(CITY_OVERLAY_SOURCE)
    this.removeLayer(CITY_BOUND_LAYER)
    this.removeSource(CITY_BOUND_SOURCE)
    this._cityBoundary = null
    this._map.setMaxBounds(null)
    this._map.setMinZoom(0)
    if (this._boundaryMouseHandler) {
      this._map.off('mousemove', this._boundaryMouseHandler)
      this._boundaryMouseHandler = null
      this._map.getCanvas().style.cursor = ''
    }
    return this
  }

  // ── Hazard PMTile layers ──────────────────────────────────────────────────────

  /** Stable key for a hazard tile, used for source/layer IDs and visibility toggling. */
  hazardKey(tile: Pick<HazardTile, 'hazard_type' | 'scenario'>): string {
    return `${tile.hazard_type}::${tile.scenario ?? 'all'}`
  }

  /**
   * Loads all hazard PMTile sources and layers.
   * Renders below the city-restriction overlay so the gray mask dims
   * hazard areas outside the city boundary.
   * Re-entrant: clears existing hazard layers before loading new ones.
   */
  setHazardLayers(tiles: HazardTile[]): this {
    if (!this._map.isStyleLoaded()) {
      this._map.once('idle', () => this.setHazardLayers(tiles))
      return this
    }

    this.clearHazardLayers()

    // Insert hazard layers beneath the boundary outline so the outline stays on top.
    const beforeId = this._map.getLayer(CITY_BOUND_LAYER) ? CITY_BOUND_LAYER : undefined

    for (const tile of tiles) {
      const key      = this.hazardKey(tile)
      const sourceId = `hazard-src-${key}`
      const layerId  = `hazard-lyr-${key}`
      const srcLayer = tile.source_layer ?? HAZARD_SOURCE_LAYER[tile.hazard_type] ?? DEFAULT_HAZARD_SOURCE_LAYER
      const color    = HAZARD_COLORS[tile.hazard_type] ?? '#6b7280'

      this._map.addSource(sourceId, {
        type: 'vector',
        url: `pmtiles://${tile.pmtile_url}`,
      })

      if (tile.hazard_type === 'faultline') {
        this._map.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          'source-layer': srcLayer,
          layout: { visibility: 'none' },
          paint: {
            'line-color': color,
            'line-width': 2,
            'line-opacity': 0.9,
          },
        }, beforeId)
      } else {
        this._map.addLayer({
          id: layerId,
          type: 'fill',
          source: sourceId,
          'source-layer': srcLayer,
          layout: { visibility: 'none' },
          paint: {
            'fill-color': color,
            'fill-opacity': this._hazardOpacity(tile.scenario),
          },
        }, beforeId)
      }

      this._hazardKeys.add(key)
    }

    return this
  }

  /** Remove all hazard layers and their sources from the map. */
  clearHazardLayers(): this {
    for (const key of this._hazardKeys) {
      this.removeLayer(`hazard-lyr-${key}`)
      this.removeSource(`hazard-src-${key}`)
    }
    this._hazardKeys.clear()
    return this
  }

  /** Show or hide a single hazard layer by its key (`hazardKey(tile)`). */
  setHazardLayerVisible(key: string, visible: boolean): this {
    this.setLayerVisibility(`hazard-lyr-${key}`, visible)
    return this
  }

  /**
   * Returns true if [lng, lat] falls inside the current city boundary.
   * Returns true when no boundary is set (no restriction).
   * Uses turf booleanPointInPolygon — handles holes and MultiPolygon correctly.
   */
  isInsideBoundary(lng: number, lat: number): boolean {
    if (!this._cityBoundary) return true
    return booleanPointInPolygon(turfPoint([lng, lat]), this._cityBoundary as Parameters<typeof booleanPointInPolygon>[1])
  }

  /** Returns [lng, lat] centroid of a boundary geometry. */
  getCentroid(boundary: BoundaryGeometry): [number, number] {
    const c = turfCentroid(boundary as Parameters<typeof turfCentroid>[0])
    return c.geometry.coordinates as [number, number]
  }

  // ── Zoning PMTile layer ───────────────────────────────────────────────────────

  /** Load city zoning PMTile as fill + outline layers. Re-entrant — clears previous layer first.
   *  onReady fires synchronously after layers are added (including when deferred to idle). */
  setZoningLayer(url: string, sourceLayer: string, onReady?: () => void): this {
    if (!this._map.isStyleLoaded()) {
      this._map.once('idle', () => this.setZoningLayer(url, sourceLayer, onReady))
      return this
    }
    this.clearZoningLayer()
    this._map.addSource(ZONING_SOURCE, { type: 'vector', url: `pmtiles://${url}` })
    const beforeId = this._map.getLayer(CITY_BOUND_LAYER) ? CITY_BOUND_LAYER : undefined
    this._map.addLayer({
      id: ZONING_FILL,
      type: 'fill',
      source: ZONING_SOURCE,
      'source-layer': sourceLayer,
      layout: { visibility: 'none' },
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.65 },
    }, beforeId)
    this._map.addLayer({
      id: ZONING_LINE,
      type: 'line',
      source: ZONING_SOURCE,
      'source-layer': sourceLayer,
      layout: { visibility: 'none' },
      paint: { 'line-color': ['get', 'color'], 'line-width': 1, 'line-opacity': 0.9 },
    }, beforeId)
    onReady?.()
    return this
  }

  clearZoningLayer(): this {
    this.removeLayer(ZONING_FILL)
    this.removeLayer(ZONING_LINE)
    this.removeSource(ZONING_SOURCE)
    return this
  }

  setZoningLayerVisible(visible: boolean): this {
    this.setLayerVisibility(ZONING_FILL, visible)
    this.setLayerVisibility(ZONING_LINE, visible)
    return this
  }

  /** Filter zoning layers to only show the given zone_type values. Pass null to clear the filter (show all). */
  setZoningTypeFilter(visibleTypes: string[] | null): this {
    if (!this._map.getLayer(ZONING_FILL)) return this
    const filter = visibleTypes === null
      ? null
      : visibleTypes.length === 0
        ? ['==', false, true] as unknown as maplibregl.FilterSpecification
        : ['in', ['get', 'zone_type'], ['literal', visibleTypes]] as unknown as maplibregl.FilterSpecification
    this._map.setFilter(ZONING_FILL, filter)
    this._map.setFilter(ZONING_LINE, filter)
    return this
  }

  // ── Image overlays (georeferencing) ──────────────────────────────────────────

  /** Add a raster image overlay. corners = [TL, TR, BR, BL] in [lng, lat]. */
  addImageOverlay(id: string, url: string, corners: ImageCorners): this {
    if (!this._map.isStyleLoaded()) {
      this._map.once('idle', () => this.addImageOverlay(id, url, corners))
      return this
    }
    this.removeImageOverlay(id)
    const srcId = `img-src-${id}`
    const lyrId = `img-lyr-${id}`
    this._map.addSource(srcId, { type: 'image', url, coordinates: corners })
    this._map.addLayer({ id: lyrId, type: 'raster', source: srcId, paint: { 'raster-opacity': 0.75 } })
    this._imageOverlayIds.add(id)
    return this
  }

  /** Update the four corners of an existing image overlay. */
  updateImageOverlay(id: string, corners: ImageCorners): this {
    const source = this._map.getSource(`img-src-${id}`) as maplibregl.ImageSource | undefined
    source?.setCoordinates(corners)
    return this
  }

  setImageOverlayOpacity(id: string, opacity: number): this {
    return this.setPaintProperty(`img-lyr-${id}`, 'raster-opacity', opacity)
  }

  removeImageOverlay(id: string): this {
    this.removeLayer(`img-lyr-${id}`)
    this.removeSource(`img-src-${id}`)
    this._imageOverlayIds.delete(id)
    return this
  }

  clearImageOverlays(): this {
    for (const id of this._imageOverlayIds) {
      this.removeLayer(`img-lyr-${id}`)
      this.removeSource(`img-src-${id}`)
    }
    this._imageOverlayIds.clear()
    return this
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  // ── Zone click handler ────────────────────────────────────────────────────────

  setupZoneClickHandler(handler: (id: string, zoneType: string, lngLat: maplibregl.LngLat) => void): this {
    this.teardownZoneClickHandler()
    const click = (e: maplibregl.MapLayerMouseEvent) => {
      const feat = e.features?.[0]
      if (!feat) return
      const props = feat.properties as { id?: string; zone_type?: string }
      // id may live in feat.properties.id (tippecanoe keeps it as property)
      // or in feat.id (tippecanoe promoted it to tile feature ID)
      const id = props.id ?? (feat.id != null ? String(feat.id) : undefined)
      if (id) handler(id, props.zone_type ?? '', e.lngLat)
    }
    const enter = () => { this._map.getCanvas().style.cursor = 'pointer' }
    const leave = () => { this._map.getCanvas().style.cursor = '' }
    this._zoneClickListeners = { click, enter, leave }
    this._map.on('click', ZONING_FILL, click)
    this._map.on('mouseenter', ZONING_FILL, enter)
    this._map.on('mouseleave', ZONING_FILL, leave)
    return this
  }

  teardownZoneClickHandler(): this {
    if (!this._zoneClickListeners) return this
    const { click, enter, leave } = this._zoneClickListeners
    this._map.off('click', ZONING_FILL, click)
    this._map.off('mouseenter', ZONING_FILL, enter)
    this._map.off('mouseleave', ZONING_FILL, leave)
    this._zoneClickListeners = null
    return this
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  destroy(): void {
    this._destroyed = true
    this.teardownZoneClickHandler()
    this.clearMarkers()
    this.clearPopups()
    this.clearHazardLayers()
    this.clearZoningLayer()
    this.clearImageOverlays()
    this.clearCityBoundary()
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  /** Fill opacity by scenario — deeper events render more opaque. */
  private _hazardOpacity(scenario: string | null): number {
    switch (scenario) {
      case '5yr':   return 0.30
      case '25yr':  return 0.45
      case '100yr': return 0.60
      case 'ssa1':  return 0.30
      case 'ssa2':  return 0.40
      case 'ssa3':  return 0.50
      case 'ssa4':  return 0.60
      default:      return 0.45
    }
  }

  /**
   * Lock panning to the city bbox + a small buffer so the user cannot browse
   * to unrelated areas of the map.
   */
  private _restrictViewToBoundary(boundary: BoundaryGeometry): void {
    const [w, s, e, n] = this._bbox(boundary)
    const buf = 0.3
    this._map.setMaxBounds([[w - buf, s - buf], [e + buf, n + buf]])
    // Prevent zooming out past ~10 km so the city stays in focus
    this._map.setMinZoom(11)
  }

  /** Compute [west, south, east, north] bounding box of a boundary geometry. */
  private _bbox(boundary: BoundaryGeometry): [number, number, number, number] {
    return turfBbox(boundary as Parameters<typeof turfBbox>[0]) as [number, number, number, number]
  }

  /**
   * Returns a GeoJSON feature covering the world minus the city boundary.
   * turf v7 difference() takes a FeatureCollection of exactly 2 features.
   */
  private _outsideOverlayGeometry(boundary: BoundaryGeometry) {
    try {
      const world = bboxPolygon([-180, -85.051129, 180, 85.051129])
      const city  = { type: 'Feature' as const, geometry: boundary as GeoJSON.Polygon | GeoJSON.MultiPolygon, properties: {} }
      return difference(featureCollection([world, city]))
    } catch {
      return null
    }
  }
}