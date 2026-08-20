import type { HazardTile } from '@/engine/map.engine'

export interface ZoningTile {
  url: string
  sourceLayer: string
}

export interface MapLayerState {
  hazardLayers:       HazardTile[]
  visibleHazardKeys:  Set<string>
  showAllHazards:     boolean
  zoningTile:         ZoningTile | null
  showZoning:         boolean
  visibleZoningTypes: Set<string> | null  // null = all types visible (no filter)
}

export type MapLayerAction =
  | { type: 'SET_HAZARD_LAYERS'; tiles: HazardTile[] }
  | { type: 'TOGGLE_HAZARD'; key: string }
  | { type: 'SET_SHOW_ALL_HAZARDS'; value: boolean }
  | { type: 'RESET_HAZARD_VISIBILITY' }
  | { type: 'SET_ZONING_TILE'; tile: ZoningTile | null }
  | { type: 'SET_SHOW_ZONING'; value: boolean }
  | { type: 'TOGGLE_ZONING_TYPE'; zoneType: string; allTypes: string[] }
  | { type: 'TOGGLE_ZONING_TYPE_GROUP'; zoneTypes: string[]; allTypes: string[] }
  | { type: 'RESET_ZONING_TYPES' }
  | { type: 'CLEAR_CITY' }

export const MAP_LAYER_INITIAL: MapLayerState = {
  hazardLayers:       [],
  visibleHazardKeys:  new Set(),
  showAllHazards:     true,
  zoningTile:         null,
  showZoning:         false,
  visibleZoningTypes: null,
}

function hazardKey(tile: Pick<HazardTile, 'hazard_type' | 'scenario'>): string {
  return `${tile.hazard_type}::${tile.scenario ?? 'all'}`
}

export function mapLayerReducer(state: MapLayerState, action: MapLayerAction): MapLayerState {
  switch (action.type) {

    case 'SET_HAZARD_LAYERS': {
      // Preserve visibility for tiles that still exist after a refresh.
      // Without this, navigating back to /map would reset all toggle selections.
      const incomingKeys = new Set(action.tiles.map(hazardKey))
      const preserved   = new Set([...state.visibleHazardKeys].filter(k => incomingKeys.has(k)))
      return { ...state, hazardLayers: action.tiles, visibleHazardKeys: preserved }
    }

    case 'TOGGLE_HAZARD': {
      const next = new Set(state.visibleHazardKeys)
      if (next.has(action.key)) next.delete(action.key)
      else next.add(action.key)
      return { ...state, visibleHazardKeys: next }
    }

    case 'SET_SHOW_ALL_HAZARDS':
      return { ...state, showAllHazards: action.value }

    case 'RESET_HAZARD_VISIBILITY':
      return {
        ...state,
        visibleHazardKeys: new Set(state.hazardLayers.map(hazardKey)),
      }

    case 'SET_ZONING_TILE':
      return {
        ...state,
        zoningTile:         action.tile,
        showZoning:         false,
        visibleZoningTypes: null,
      }

    case 'SET_SHOW_ZONING':
      return { ...state, showZoning: action.value }

    case 'TOGGLE_ZONING_TYPE': {
      const allSet = new Set(action.allTypes)

      if (!state.showZoning) {
        // Layer was hidden — show it with ONLY the clicked type visible.
        return {
          ...state,
          showZoning:         true,
          visibleZoningTypes: new Set([action.zoneType]),
        }
      }

      // Layer is visible — toggle this type within the current filter.
      const prev = state.visibleZoningTypes === null
        ? new Set(action.allTypes)
        : new Set(state.visibleZoningTypes)

      if (prev.has(action.zoneType)) prev.delete(action.zoneType)
      else prev.add(action.zoneType)

      // All types visible → clear filter (null = no filter applied).
      if (prev.size === allSet.size) {
        return { ...state, visibleZoningTypes: null }
      }
      // No types visible → hide the layer entirely.
      if (prev.size === 0) {
        return { ...state, showZoning: false, visibleZoningTypes: null }
      }
      return { ...state, visibleZoningTypes: prev }
    }

    case 'TOGGLE_ZONING_TYPE_GROUP': {
      const allSet  = new Set(action.allTypes)
      const groupSet = new Set(action.zoneTypes)

      if (!state.showZoning) {
        // Layer was hidden → show it with ONLY this group visible
        return { ...state, showZoning: true, visibleZoningTypes: new Set(action.zoneTypes) }
      }

      const prev = state.visibleZoningTypes === null
        ? new Set(action.allTypes)
        : new Set(state.visibleZoningTypes)

      // Group is "on" if any of its types are currently visible
      const groupVisible = action.zoneTypes.some(t => prev.has(t))

      if (groupVisible) {
        // Hide all group types
        action.zoneTypes.forEach(t => prev.delete(t))
      } else {
        // Show all group types
        action.zoneTypes.forEach(t => prev.add(t))
      }

      if (prev.size === 0) return { ...state, showZoning: false, visibleZoningTypes: null }
      if (prev.size === allSet.size && [...prev].every(t => allSet.has(t))) {
        return { ...state, visibleZoningTypes: null }
      }
      // Remove any group keys that aren't in allTypes (shouldn't happen but guard it)
      const next = new Set([...prev].filter(t => allSet.has(t) || groupSet.has(t)))
      return { ...state, visibleZoningTypes: next }
    }

    case 'RESET_ZONING_TYPES':
      return { ...state, visibleZoningTypes: null }

    case 'CLEAR_CITY':
      return MAP_LAYER_INITIAL

    default:
      return state
  }
}
