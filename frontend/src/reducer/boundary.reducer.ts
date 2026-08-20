export type BoundaryPhase = 'idle' | 'loading' | 'loaded' | 'error'

export interface BoundaryState {
  phase: BoundaryPhase
  error: string | null
}

export type BoundaryAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS' }
  | { type: 'FETCH_ERROR'; error: string }
  | { type: 'RESET' }

export const BOUNDARY_INITIAL: BoundaryState = { phase: 'idle', error: null }

export function boundaryReducer(state: BoundaryState, action: BoundaryAction): BoundaryState {
  switch (action.type) {
    case 'FETCH_START':
      return { phase: 'loading', error: null }
    case 'FETCH_SUCCESS':
      return { phase: 'loaded', error: null }
    case 'FETCH_ERROR':
      return { phase: 'error', error: action.error }
    case 'RESET':
      return BOUNDARY_INITIAL
    default:
      return state
  }
}
