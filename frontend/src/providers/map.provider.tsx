import { useState, useEffect, useCallback, useReducer, useRef, type PropsWithChildren } from 'react'
import { MapContext, type LightPreset, type ClickedZone } from '@/context/map.context'
import { useCityContext } from '@/context/city.context'
import { fetchClient } from '@/lib/api-client'
import type { MapEngine, HazardTile } from '@/engine/map.engine'
import { mapLayerReducer, MAP_LAYER_INITIAL } from '@/reducer/map-layer.reducer'

// ── PMTile source-layer discovery ────────────────────────────────────────────
// Reads the PMTile's TileJSON metadata to find the first vector layer id.
// This is the name tippecanoe baked in from the input filename stem.
// Requires MinIO CORS to be configured (GET + HEAD from the frontend origin).

async function discoverSourceLayer(url: string): Promise<string | undefined> {
  try {
    const { PMTiles } = await import('pmtiles')
    const pm   = new PMTiles(url)
    const meta = await pm.getMetadata() as { vector_layers?: { id: string }[] } | null
    const id   = meta?.vector_layers?.[0]?.id
    if (id) console.debug(`[PMTile] source-layer="${id}" for ${url.split('/').slice(-3, -1).join('/')}`)
    return id
  } catch (err) {
    console.warn('[PMTile] metadata fetch failed — CORS may not be configured on MinIO:', err)
    return undefined
  }
}

async function enrichWithSourceLayers(tiles: HazardTile[]): Promise<HazardTile[]> {
  return Promise.all(
    tiles.map(async tile => ({
      ...tile,
      source_layer: await discoverSourceLayer(tile.pmtile_url),
    }))
  )
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function MapProvider({ children }: PropsWithChildren) {
  const [engine, setEngine] = useState<MapEngine | null>(null)
  const [lightPreset, setLightPreset] = useState<LightPreset>('day')
  const [show3D, setShow3D] = useState(true)
  const [layers, dispatchLayers] = useReducer(mapLayerReducer, MAP_LAYER_INITIAL)
  const [clickedZone, setClickedZone] = useState<ClickedZone | null>(null)

  const { selectedCity, cityBoundary } = useCityContext()

  // Always-current refs so onReady callbacks inside setZoningLayer read latest state.
  const showZoningRef = useRef(layers.showZoning)
  showZoningRef.current = layers.showZoning
  const visibleZoningTypesRef = useRef(layers.visibleZoningTypes)
  visibleZoningTypesRef.current = layers.visibleZoningTypes

  // Destructure for use in effects (keeps dep arrays tidy)
  const { hazardLayers, visibleHazardKeys, showAllHazards, zoningTile, showZoning, visibleZoningTypes } = layers

  // ── Light preset ─────────────────────────────────────────────────────────

  useEffect(() => {
    engine?.setLightPreset(lightPreset)
  }, [engine, lightPreset])

  // ── Terrain ──────────────────────────────────────────────────────────────

  useEffect(() => {
    engine?.setTerrain(show3D)
  }, [engine, show3D])

  // ── City boundary + pan restriction ──────────────────────────────────────
  // Geometry is fetched separately by CityProvider and exposed as cityBoundary.

  useEffect(() => {
    if (!engine) return

    if (!selectedCity) {
      engine.clearCityBoundary()
      return
    }

    if (!cityBoundary) return

    // fly handled by map.tsx — only set the boundary overlay here
    engine.setCityBoundary(cityBoundary)
  }, [engine, selectedCity?.id, cityBoundary])

  // ── Hazard PMTile fetch ───────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedCity?.id) return

    let cancelled = false

    fetchClient.GET('/cities/{city_id}/hazards/pmtiles', { params: { path: { city_id: selectedCity.id } } })
      .then(async res => {
        if (cancelled) return
        if (res.error) return // Province has no hazard data yet.
        const tiles = await enrichWithSourceLayers(res.data as unknown as HazardTile[])
        if (cancelled) return
        dispatchLayers({ type: 'SET_HAZARD_LAYERS', tiles })
      })

    return () => {
      cancelled = true
      dispatchLayers({ type: 'CLEAR_CITY' })
    }
  }, [selectedCity?.id])

  // ── Zoning PMTile fetch ───────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedCity?.id) return

    let cancelled = false

    fetchClient.GET('/cities/{city_id}/zoning/pmtiles', { params: { path: { city_id: selectedCity.id } } })
      .then(async res => {
        if (cancelled) return
        if (res.error || !res.data) {
          dispatchLayers({ type: 'SET_ZONING_TILE', tile: null })
          return
        }
        const url = res.data.pmtile_url
        const sl  = await discoverSourceLayer(url)
        if (cancelled) return
        dispatchLayers({ type: 'SET_ZONING_TILE', tile: { url, sourceLayer: sl ?? 'zoning' } })
      })

    return () => {
      cancelled = true
      dispatchLayers({ type: 'SET_ZONING_TILE', tile: null })
    }
  }, [selectedCity?.id])

  // ── Load zoning layer into engine ─────────────────────────────────────────

  useEffect(() => {
    if (!engine) return
    if (!zoningTile) {
      engine.clearZoningLayer()
      return
    }
    engine.setZoningLayer(zoningTile.url, zoningTile.sourceLayer, () => {
      engine.setZoningLayerVisible(showZoningRef.current)
      engine.setZoningTypeFilter(
        visibleZoningTypesRef.current === null ? null : [...visibleZoningTypesRef.current]
      )
    })
  }, [engine, zoningTile])

  // ── Sync zoning visibility ────────────────────────────────────────────────

  useEffect(() => {
    engine?.setZoningLayerVisible(showZoning)
  }, [engine, showZoning])

  // ── Load hazard layers into engine ────────────────────────────────────────

  useEffect(() => {
    if (!engine) return
    engine.setHazardLayers(hazardLayers)
  }, [engine, hazardLayers])

  // ── Sync visibility state → engine ───────────────────────────────────────
  // showAllHazards acts as master switch; visibleHazardKeys preserves individual selections.

  useEffect(() => {
    if (!engine) return
    for (const tile of hazardLayers) {
      const key = engine.hazardKey(tile)
      engine.setHazardLayerVisible(key, showAllHazards && visibleHazardKeys.has(key))
    }
  }, [engine, hazardLayers, visibleHazardKeys, showAllHazards])

  // ── Sync zoning type filter → engine ─────────────────────────────────────

  useEffect(() => {
    if (!engine) return
    engine.setZoningTypeFilter(visibleZoningTypes === null ? null : [...visibleZoningTypes])
  }, [engine, visibleZoningTypes])

  const toggleHazard        = useCallback((key: string) =>
    dispatchLayers({ type: 'TOGGLE_HAZARD', key }), [])

  const resetZoningTypes    = useCallback(() =>
    dispatchLayers({ type: 'RESET_ZONING_TYPES' }), [])

  const resetHazardVisibility = useCallback(() =>
    dispatchLayers({ type: 'RESET_HAZARD_VISIBILITY' }), [])

  const toggleZoningType      = useCallback((zoneType: string, allTypes: string[]) =>
    dispatchLayers({ type: 'TOGGLE_ZONING_TYPE', zoneType, allTypes }), [])

  const toggleZoningTypeGroup = useCallback((zoneTypes: string[], allTypes: string[]) =>
    dispatchLayers({ type: 'TOGGLE_ZONING_TYPE_GROUP', zoneTypes, allTypes }), [])

  // ── Zone click handler ────────────────────────────────────────────────────

  useEffect(() => {
    if (!engine) return
    engine.setupZoneClickHandler((id, zoneType, lngLat) => {
      setClickedZone({ id, zoneType, lngLat: { lng: lngLat.lng, lat: lngLat.lat } })
    })
    return () => { engine.teardownZoneClickHandler() }
  }, [engine])

  const refreshZoningLayer = useCallback(async (url: string | null) => {
    if (!url) { dispatchLayers({ type: 'SET_ZONING_TILE', tile: null }); return }
    const sl = await discoverSourceLayer(url)
    dispatchLayers({ type: 'SET_ZONING_TILE', tile: { url, sourceLayer: sl ?? 'zoning' } })
  }, [])

  const refreshHazardLayers = useCallback(async () => {
    if (!selectedCity?.id) return
    const res = await fetchClient.GET('/cities/{city_id}/hazards/pmtiles', { params: { path: { city_id: selectedCity.id } } })
    if (res.error) return // city has no hazard data
    const tiles = await enrichWithSourceLayers(res.data as unknown as HazardTile[])
    dispatchLayers({ type: 'SET_HAZARD_LAYERS', tiles })
  }, [selectedCity?.id])


  return (
    <MapContext.Provider value={{
      engine, setEngine,
      lightPreset, setLightPreset,
      show3D, setShow3D,
      hazardLayers,
      visibleHazardKeys,
      toggleHazard,
      showAllHazards,
      setShowAllHazards: (value) => dispatchLayers({ type: 'SET_SHOW_ALL_HAZARDS', value }),
      zoningPmtileUrl: zoningTile?.url ?? null,
      showZoning,
      setShowZoning: (value) => dispatchLayers({ type: 'SET_SHOW_ZONING', value }),
      visibleZoningTypes,
      toggleZoningType,
      toggleZoningTypeGroup,
      resetZoningTypes,
      resetHazardVisibility,
      clickedZone,
      setClickedZone,
      refreshZoningLayer,
      refreshHazardLayers,
    }}>
      {children}
    </MapContext.Provider>
  )
}