import type { Polygon } from 'geojson'
import type { HazardType } from './hazard-draw.reducer'

export type HazardUploadPhase = 'idle' | 'ready' | 'saving' | 'saved' | 'error'

export interface HazardUploadState {
  phase:      HazardUploadPhase
  hazardType: HazardType
  scenario:   string | null
  severity:   number
  fileName:   string | null
  geometry:   Polygon | null
  errorMsg:   string | null
}

export type HazardUploadAction =
  | { type: 'SET_FILE';        fileName: string; geometry: Polygon }
  | { type: 'CLEAR_FILE' }
  | { type: 'SET_HAZARD_TYPE'; hazardType: HazardType }
  | { type: 'SET_SCENARIO';    scenario:   string | null }
  | { type: 'SET_SEVERITY';    severity:   number }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_SUCCESS' }
  | { type: 'SAVE_ERROR';      errorMsg: string }
  | { type: 'RESET' }

export const HAZARD_UPLOAD_INITIAL: HazardUploadState = {
  phase:      'idle',
  hazardType: 'flood',
  scenario:   '100yr',
  severity:   3,
  fileName:   null,
  geometry:   null,
  errorMsg:   null,
}

export function hazardUploadReducer(
  state: HazardUploadState,
  action: HazardUploadAction,
): HazardUploadState {
  switch (action.type) {
    case 'SET_FILE':
      if (state.phase === 'saving') return state
      return { ...state, phase: 'ready', fileName: action.fileName, geometry: action.geometry, errorMsg: null }

    case 'CLEAR_FILE':
      if (state.phase === 'saving') return state
      return { ...state, phase: 'idle', fileName: null, geometry: null, errorMsg: null }

    case 'SET_HAZARD_TYPE':
      if (state.phase === 'saving') return state
      return { ...state, hazardType: action.hazardType }

    case 'SET_SCENARIO':
      if (state.phase === 'saving') return state
      return { ...state, scenario: action.scenario }

    case 'SET_SEVERITY':
      if (state.phase === 'saving') return state
      return { ...state, severity: action.severity }

    case 'SAVE_START':
      if (state.phase !== 'ready') return state
      return { ...state, phase: 'saving', errorMsg: null }

    case 'SAVE_SUCCESS':
      if (state.phase !== 'saving') return state
      return { ...state, phase: 'saved' }

    case 'SAVE_ERROR':
      if (state.phase !== 'saving') return state
      return { ...state, phase: 'error', errorMsg: action.errorMsg }

    case 'RESET':
      return HAZARD_UPLOAD_INITIAL

    default:
      return state
  }
}
