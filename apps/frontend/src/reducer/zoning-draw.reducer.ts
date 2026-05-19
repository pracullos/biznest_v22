import type { Polygon } from 'geojson'

export type ZoneType = 'residential' | 'commercial' | 'industrial' | 'agriculture'
export type DrawMode = 'draw_polygon' | 'draw_freehand'

export type ZoningDrawPhase =
  | 'configuring'
  | 'drawing'
  | 'drawn'
  | 'saving'
  | 'saved'
  | 'error'

export interface ZoningDrawState {
  phase:      ZoningDrawPhase
  zoneType:   ZoneType
  severity:   number
  drawMode:   DrawMode
  geometry:   Polygon | null
  pointCount: number
  errorMsg:   string | null
}

export type ZoningDrawAction =
  | { type: 'SET_ZONE_TYPE';      zoneType: ZoneType }
  | { type: 'SET_SEVERITY';       severity: number }
  | { type: 'SET_DRAW_MODE';      drawMode: DrawMode }
  | { type: 'START_DRAWING' }
  | { type: 'CANCEL_DRAWING' }
  | { type: 'SHAPE_DRAWN';        geometry: Polygon; pointCount: number }
  | { type: 'FREEHAND_COMPLETE';  geometry: Polygon; pointCount: number }
  | { type: 'CLEAR_SHAPE' }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_SUCCESS' }
  | { type: 'SAVE_ERROR';         errorMsg: string }
  | { type: 'DRAW_ANOTHER' }

export const ZONING_DRAW_INITIAL: ZoningDrawState = {
  phase:      'configuring',
  zoneType:   'residential',
  severity:   3,
  drawMode:   'draw_polygon',
  geometry:   null,
  pointCount: 0,
  errorMsg:   null,
}

export function zoningDrawReducer(
  state: ZoningDrawState,
  action: ZoningDrawAction,
): ZoningDrawState {
  switch (action.type) {
    case 'SET_ZONE_TYPE':
      if (state.phase === 'drawing' || state.phase === 'saving') return state
      return { ...state, zoneType: action.zoneType }

    case 'SET_SEVERITY':
      if (state.phase === 'saving') return state
      return { ...state, severity: action.severity }

    case 'SET_DRAW_MODE':
      if (state.phase === 'drawing' || state.phase === 'saving') return state
      return { ...state, drawMode: action.drawMode }

    case 'START_DRAWING':
      if (state.phase !== 'configuring' && state.phase !== 'drawn') return state
      return { ...state, phase: 'drawing', geometry: null, pointCount: 0 }

    case 'CANCEL_DRAWING':
      if (state.phase !== 'drawing') return state
      return { ...state, phase: 'configuring' }

    case 'SHAPE_DRAWN':
      if (state.phase !== 'drawing') return state
      return { ...state, phase: 'drawn', geometry: action.geometry, pointCount: action.pointCount }

    case 'FREEHAND_COMPLETE':
      if (state.phase !== 'drawing') return state
      return { ...state, phase: 'drawn', geometry: action.geometry, pointCount: action.pointCount, errorMsg: null }

    case 'CLEAR_SHAPE':
      if (state.phase !== 'drawn') return state
      return { ...state, phase: 'configuring', geometry: null, pointCount: 0 }

    case 'SAVE_START':
      if (state.phase !== 'drawn' && state.phase !== 'error') return state
      return { ...state, phase: 'saving', errorMsg: null }

    case 'SAVE_SUCCESS':
      if (state.phase !== 'saving') return state
      return { ...state, phase: 'saved' }

    case 'SAVE_ERROR':
      if (state.phase !== 'saving') return state
      return { ...state, phase: 'error', errorMsg: action.errorMsg }

    case 'DRAW_ANOTHER':
      return { ...state, phase: 'configuring', geometry: null, pointCount: 0, errorMsg: null }

    default:
      return state
  }
}
