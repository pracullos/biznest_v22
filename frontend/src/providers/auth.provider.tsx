import { useReducer, useEffect, useRef, type PropsWithChildren } from 'react'
import { flushSync } from 'react-dom'
import { fetchClient, unwrap } from '@/lib/api-client'
import { tokenManager } from '@/lib/token-manager'
import { ensureRefreshed, onRefreshFailure } from '@/lib/auth-refresh'
import { router } from '@/router'
import { AuthContext, type AuthData, type AuthState } from '@/context/auth.context'
import type { UserResponse, CityResponse } from '@/types/api-aliases'
import { ALL_PERMISSIONS, ROLE_PERMISSIONS } from '@/config/permissions'
import { authReducer } from '@/reducer/auth.reducer'
import {
  getTokenExpiry,
  resolveRoleFromToken,
  postAuthRoute,
} from '@/utils/jwt.utils'

const CITY_ID_KEY = 'biznest:city_id'

// Refresh this many ms before the access token actually expires
const PROACTIVE_REFRESH_LEAD_MS = 60_000

async function resolveAuth(user: UserResponse) {
  const { role_name, role_id } = resolveRoleFromToken()

  let permissions: string[]
  if (user.is_superuser) {
    permissions = ALL_PERMISSIONS
  } else if (role_id) {
    try {
      const role = unwrap(await fetchClient.GET('/roles/{role_id}', { params: { path: { role_id } } }))
      permissions = (role.permissions ?? []).map(p => p.name)
    } catch {
      permissions = role_name ? (ROLE_PERMISSIONS[role_name] ?? []) : []
    }
  } else {
    permissions = []
  }

  let city_ids: string[] = []
  let lgu_city: CityResponse | undefined
  try {
    if (role_name === 'investor') {
      const access = unwrap(await fetchClient.GET('/city-access/me'))
      city_ids = access.map(a => a.city_id)
    } else if (role_name === 'lgu_admin') {
      const assignments = unwrap(await fetchClient.GET('/lgu-assignments/'))
      city_ids = assignments.filter(a => a.user_id === user.id).map(a => a.city_id)
      lgu_city = unwrap(await fetchClient.GET('/lgu-assignments/user/{user_id}/city', {
        params: { path: { user_id: user.id } },
      }))
    }
  } catch {
    // non-critical — proceed with empty city list
  }

  return { user, role_name, permissions, city_ids, lgu_city }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(authReducer, { state: 'BOOT' } as AuthState)

  const isRestoringRef     = useRef(true)   // true during initial session restore
  const refreshTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleRefreshRef = useRef<((token: string) => void) | null>(null)

  // ── Proactive refresh helpers ─────────────────────────────────────────────

  function clearRefreshTimer() {
    if (refreshTimerRef.current !== null) {
      clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
  }

  async function doProactiveRefresh() {
    try {
      const token = await ensureRefreshed()
      scheduleRefreshRef.current?.(token)
    } catch {
      // onRefreshFailure (registered below) already ran the sign-out side effects
    }
  }

  function scheduleTokenRefresh(accessToken: string) {
    clearRefreshTimer()
    const exp = getTokenExpiry(accessToken)
    if (exp === null) return
    const delay = exp * 1000 - Date.now() - PROACTIVE_REFRESH_LEAD_MS
    if (delay <= 0) {
      void doProactiveRefresh()
      return
    }
    refreshTimerRef.current = setTimeout(() => void doProactiveRefresh(), delay)
  }

  scheduleRefreshRef.current = scheduleTokenRefresh

  // ── Refresh-failure handler + session restore ─────────────────────────────

  useEffect(() => {
    onRefreshFailure(() => {
      clearRefreshTimer()
      tokenManager.clear()
      sessionStorage.removeItem(CITY_ID_KEY)
      dispatch({ type: 'UNAUTHENTICATED' })
      // Don't redirect during initial restore — the user may be on a public
      // page (e.g. /lgu/register) that is valid without authentication.
      if (!isRestoringRef.current) {
        void router.navigate({ to: '/login' })
      }
    })

    void restoreSession()

    return () => {
      clearRefreshTimer()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Auth actions ──────────────────────────────────────────────────────────

  async function restoreSession() {
    isRestoringRef.current = true
    dispatch({ type: 'RESTORE_START' })
    try {
      const user   = unwrap(await fetchClient.GET('/auth/me'))
      const result = await resolveAuth(user)

      let city_id: string | undefined

      if (result.role_name === 'investor') {
        const savedCityId = sessionStorage.getItem(CITY_ID_KEY)
        if (savedCityId && result.city_ids.includes(savedCityId)) {
          try {
            const select = unwrap(await fetchClient.POST('/city-access/select/{city_id}', {
              params: { path: { city_id: savedCityId } },
            }))
            tokenManager.set(select.access_token)
            city_id = savedCityId
          } catch {
            sessionStorage.removeItem(CITY_ID_KEY)
          }
        }
      } else if (result.role_name === 'lgu_admin' && result.lgu_city) {
        city_id = result.lgu_city.id
        sessionStorage.setItem(CITY_ID_KEY, city_id)
      }

      dispatch({ type: 'AUTH_SUCCESS', ...result, city_id })

      const currentToken = tokenManager.get()
      if (currentToken) scheduleTokenRefresh(currentToken)
    } catch {
      clearRefreshTimer()
      tokenManager.clear()
      sessionStorage.removeItem(CITY_ID_KEY)
      dispatch({ type: 'UNAUTHENTICATED' })
    } finally {
      isRestoringRef.current = false
    }
  }

  async function signIn(email: string, password: string) {
    const login = unwrap(await fetchClient.POST('/auth/login', { body: { email, password } }))
    tokenManager.set(login.access_token)
    scheduleTokenRefresh(login.access_token)
    const user   = unwrap(await fetchClient.GET('/auth/me'))
    const result = await resolveAuth(user)
    sessionStorage.removeItem(CITY_ID_KEY)
    const target = postAuthRoute(result.role_name, user.is_superuser)
    flushSync(() => dispatch({ type: 'AUTH_SUCCESS', ...result }))
    await router.navigate({ to: target as never })
  }

  async function register(
    email: string,
    full_name: string,
    password: string,
    role: 'investor' | 'lgu_admin' = 'investor',
  ) {
    const registered = unwrap(await fetchClient.POST('/auth/register', {
      body: { email, full_name, password, role_name: role },
    }))
    tokenManager.set(registered.access_token)
    scheduleTokenRefresh(registered.access_token)
    const user   = unwrap(await fetchClient.GET('/auth/me'))
    const result = await resolveAuth(user)
    sessionStorage.removeItem(CITY_ID_KEY)
    const target = postAuthRoute(result.role_name, user.is_superuser)
    flushSync(() => dispatch({ type: 'AUTH_SUCCESS', ...result }))
    await router.navigate({ to: target as never })
  }

  async function signOut() {
    dispatch({ type: 'SIGN_OUT' })
    clearRefreshTimer()
    try {
      await fetchClient.POST('/auth/logout')
    } finally {
      tokenManager.clear()
      sessionStorage.removeItem(CITY_ID_KEY)
      dispatch({ type: 'UNAUTHENTICATED' })
      await router.navigate({ to: '/login' })
    }
  }

  async function refreshCities() {
    if (state.state !== 'AUTHENTICATED') return
    const result  = await resolveAuth(state.user)
    let city_id   = state.city_id
    if (result.role_name === 'lgu_admin' && result.lgu_city) {
      city_id = result.lgu_city.id
      sessionStorage.setItem(CITY_ID_KEY, city_id)
    }
    dispatch({ type: 'AUTH_SUCCESS', ...result, city_id })
  }

  async function selectCity(cityId: string) {
    if (state.state !== 'AUTHENTICATED') return

    if (state.role_name === 'investor') {
      const select = unwrap(await fetchClient.POST('/city-access/select/{city_id}', {
        params: { path: { city_id: cityId } },
      }))
      tokenManager.set(select.access_token)
      scheduleTokenRefresh(select.access_token)
    }

    sessionStorage.setItem(CITY_ID_KEY, cityId)
    dispatch({ type: 'SET_CITY', city_id: cityId })
  }

  const value: AuthData = { state, signIn, register, signOut, refreshCities, selectCity }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
