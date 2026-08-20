import { useReducer, useEffect, useRef, type PropsWithChildren } from 'react'
import { flushSync } from 'react-dom'
import axios from 'axios'
import { tokenManager } from '@/lib/axios'
import { myAccessCityAccessMeGet } from '@networking/api/generated/city-access/city-access'
import {
  listAssignmentsLguAssignmentsGet,
  getCityByUserLguAssignmentsUserUserIdCityGet,
} from '@networking/api/generated/lgu-assignments/lgu-assignments'
import { getRoleRolesRoleIdGet } from '@networking/api/generated/roles/roles'
import { router } from '@/router'
import { AuthContext, type AuthData, type AuthState } from '@/context/auth.context'
import type { UserResponse } from '@networking/api/model/userResponse'
import type { CityResponse } from '@networking/api/model/cityResponse'
import type { AuthResponse } from '@networking/api/model/authResponse'
import type { CitySelectResponse } from '@networking/api/model/citySelectResponse'
import { ALL_PERMISSIONS, ROLE_PERMISSIONS } from '@/config/permissions'
import { authReducer } from '@/reducer/auth.reducer'
import {
  getTokenExpiry,
  resolveRoleFromToken,
  postAuthRoute,
} from '@/utils/jwt.utils'

// Paths that should not trigger the 401 → refresh interceptor
const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/users/lgu/register']

const CITY_ID_KEY = 'biznest:city_id'

// Refresh this many ms before the access token actually expires
const PROACTIVE_REFRESH_LEAD_MS = 60_000

type QueueItem = { resolve: (value: unknown) => void; reject: (err: unknown) => void }

async function resolveAuth(user: UserResponse) {
  const { role_name, role_id } = resolveRoleFromToken()

  let permissions: string[]
  if (user.is_superuser) {
    permissions = ALL_PERMISSIONS
  } else if (role_id) {
    try {
      const roleRes = await getRoleRolesRoleIdGet(role_id)
      permissions = (roleRes.data.permissions ?? []).map(p => p.name)
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
      const accessRes = await myAccessCityAccessMeGet()
      city_ids = accessRes.data.map(a => a.city_id)
    } else if (role_name === 'lgu_admin') {
      const assignRes = await listAssignmentsLguAssignmentsGet()
      city_ids = assignRes.data.filter(a => a.user_id === user.id).map(a => a.city_id)
      const cityRes = await getCityByUserLguAssignmentsUserUserIdCityGet(user.id)
      lgu_city = cityRes.data
    }
  } catch {
    // non-critical — proceed with empty city list
  }

  return { user, role_name, permissions, city_ids, lgu_city }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(authReducer, { state: 'BOOT' } as AuthState)

  const isRefreshingRef    = useRef(false)
  const isRestoringRef     = useRef(true)   // true during initial session restore
  const refreshQueueRef    = useRef<QueueItem[]>([])
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
      const res = await axios.post<AuthResponse>('/auth/refresh')
      tokenManager.set(res.data.access_token)
      scheduleRefreshRef.current?.(res.data.access_token)
    } catch {
      clearRefreshTimer()
      tokenManager.clear()
      sessionStorage.removeItem(CITY_ID_KEY)
      dispatch({ type: 'UNAUTHENTICATED' })
      void router.navigate({ to: '/login' })
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

  // ── 401 interceptor + session restore ─────────────────────────────────────

  useEffect(() => {
    const interceptorId = axios.interceptors.response.use(
      (res) => res,
      async (error) => {
        const originalRequest = error.config
        const isAuthPath = AUTH_PATHS.some(p => (originalRequest?.url as string | undefined)?.includes(p))

        if (error.response?.status !== 401 || isAuthPath || originalRequest?._retry) {
          return Promise.reject(error)
        }

        if (isRefreshingRef.current) {
          return new Promise((resolve, reject) => {
            refreshQueueRef.current.push({
              resolve: () => resolve(axios(originalRequest)),
              reject,
            })
          })
        }

        originalRequest._retry = true
        isRefreshingRef.current = true

        try {
          const refreshRes = await axios.post<AuthResponse>('/auth/refresh')
          tokenManager.set(refreshRes.data.access_token)
          scheduleRefreshRef.current?.(refreshRes.data.access_token)
          refreshQueueRef.current.forEach(q => q.resolve(undefined))
          refreshQueueRef.current = []
          return axios(originalRequest)
        } catch (refreshError) {
          refreshQueueRef.current.forEach(q => q.reject(refreshError))
          refreshQueueRef.current = []
          clearRefreshTimer()
          tokenManager.clear()
          sessionStorage.removeItem(CITY_ID_KEY)
          dispatch({ type: 'UNAUTHENTICATED' })
          // Don't redirect during initial restore — the user may be on a public
          // page (e.g. /lgu/register) that is valid without authentication.
          if (!isRestoringRef.current) {
            void router.navigate({ to: '/login' })
          }
          return Promise.reject(refreshError)
        } finally {
          isRefreshingRef.current = false
        }
      }
    )

    void restoreSession()

    return () => {
      axios.interceptors.response.eject(interceptorId)
      clearRefreshTimer()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Auth actions ──────────────────────────────────────────────────────────

  async function restoreSession() {
    isRestoringRef.current = true
    dispatch({ type: 'RESTORE_START' })
    try {
      const userRes = await axios.get<UserResponse>('/auth/me')
      const result  = await resolveAuth(userRes.data)

      let city_id: string | undefined

      if (result.role_name === 'investor') {
        const savedCityId = sessionStorage.getItem(CITY_ID_KEY)
        if (savedCityId && result.city_ids.includes(savedCityId)) {
          try {
            const selectRes = await axios.post<CitySelectResponse>(`/city-access/select/${savedCityId}`)
            tokenManager.set(selectRes.data.access_token)
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
    const loginRes = await axios.post<AuthResponse>('/auth/login', { email, password })
    tokenManager.set(loginRes.data.access_token)
    scheduleTokenRefresh(loginRes.data.access_token)
    const userRes = await axios.get<UserResponse>('/auth/me')
    const result  = await resolveAuth(userRes.data)
    sessionStorage.removeItem(CITY_ID_KEY)
    const target = postAuthRoute(result.role_name, userRes.data.is_superuser)
    flushSync(() => dispatch({ type: 'AUTH_SUCCESS', ...result }))
    await router.navigate({ to: target as never })
  }

  async function register(
    email: string,
    full_name: string,
    password: string,
    role: 'investor' | 'lgu_admin' = 'investor',
  ) {
    const registerRes = await axios.post<AuthResponse>('/auth/register', { email, full_name, password, role_name: role })
    tokenManager.set(registerRes.data.access_token)
    scheduleTokenRefresh(registerRes.data.access_token)
    const userRes = await axios.get<UserResponse>('/auth/me')
    const result  = await resolveAuth(userRes.data)
    sessionStorage.removeItem(CITY_ID_KEY)
    const target = postAuthRoute(result.role_name, userRes.data.is_superuser)
    flushSync(() => dispatch({ type: 'AUTH_SUCCESS', ...result }))
    await router.navigate({ to: target as never })
  }

  async function signOut() {
    dispatch({ type: 'SIGN_OUT' })
    clearRefreshTimer()
    try {
      await axios.post('/auth/logout')
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
      const res = await axios.post<CitySelectResponse>(`/city-access/select/${cityId}`)
      tokenManager.set(res.data.access_token)
      scheduleTokenRefresh(res.data.access_token)
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
