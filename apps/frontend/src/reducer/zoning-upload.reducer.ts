import type { Polygon } from 'geojson'
import type { ScenarioType, ZoneType } from './zoning-draw.reducer'

export type ZoningUploadPhase = 'idle' | 'ready' | 'saving' | 'saved' | 'error'

export interface ZoningUploadState {
  phase:        ZoningUploadPhase
  zoneType:     ZoneType
  severity:     number
  scenario:     string | null
  scenarioType: ScenarioType | null
  fileName:     string | null
  geometry:     Polygon | null
  errorMsg:     string | null
}

export type ZoningUploadAction =
  | { type: 'SET_FILE';          fileName: string; geometry: Polygon }
  | { type: 'CLEAR_FILE' }
  | { type: 'SET_ZONE_TYPE';     zoneType: ZoneType }
  | { type: 'SET_SEVERITY';      severity: number }
  | { type: 'SET_SCENARIO';      scenario: string | null }
  | { type: 'SET_SCENARIO_TYPE'; scenarioType: ScenarioType | null }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_SUCCESS' }
  | { type: 'SAVE_ERROR';        errorMsg: string }
  | { type: 'RESET' }

export const ZONING_UPLOAD_INITIAL: ZoningUploadState = {
  phase:        'idle',
  zoneType:     'residential',
  severity:     3,
  scenario:     null,
  scenarioType: null,
  fileName:     null,
  geometry:     null,
  errorMsg:     null,
}

export function zoningUploadReducer(
  state: ZoningUploadState,
  action: ZoningUploadAction,
): ZoningUploadState {
  switch (action.type) {
    case 'SET_FILE':
      if (state.phase === 'saving') return state
      return { ...state, phase: 'ready', fileName: action.fileName, geometry: action.geometry, errorMsg: null }

    case 'CLEAR_FILE':
      if (state.phase === 'saving') return state
      return { ...state, phase: 'idle', fileName: null, geometry: null, errorMsg: null }

    case 'SET_ZONE_TYPE':
      if (state.phase === 'saving') return state
      return { ...state, zoneType: action.zoneType }

    case 'SET_SEVERITY':
      if (state.phase === 'saving') return state
      return { ...state, severity: action.severity }

    case 'SET_SCENARIO':
      if (state.phase === 'saving') return state
      return { ...state, scenario: action.scenario }

    case 'SET_SCENARIO_TYPE':
      if (state.phase === 'saving') return state
      return { ...state, scenarioType: action.scenarioType }

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
      return ZONING_UPLOAD_INITIAL

    default:
      return state
  }
}
