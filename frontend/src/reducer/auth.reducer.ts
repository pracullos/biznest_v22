import type { AuthAction, AuthState } from '@/context/auth.context'

export function authReducer(_state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'RESTORE_START':
      return { state: 'RESTORING' }
    case 'AUTH_SUCCESS':
      return {
        state:       'AUTHENTICATED',
        user:        action.user,
        role_name:   action.role_name,
        permissions: action.permissions,
        city_ids:    action.city_ids,
        lgu_city:    action.lgu_city,
        city_id:     action.city_id,
      }
    case 'SET_CITY':
      if (_state.state !== 'AUTHENTICATED') return _state
      return { ..._state, city_id: action.city_id }
    case 'UNAUTHENTICATED':
      return { state: 'UNAUTHENTICATED' }
    case 'SIGN_OUT':
      return { state: 'SIGNING_OUT' }
  }
}
