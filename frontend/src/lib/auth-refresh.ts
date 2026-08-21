import { tokenManager } from '@/lib/token-manager'
import type { components } from '@/types/api'

type AuthResponse = components['schemas']['AuthResponse']

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

// Paths the 401-refresh flow must never intercept (would loop or doesn't apply)
export const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/users/lgu/register']

let inFlight: Promise<string> | null = null
let failureHandler: (() => void) | null = null

export function onRefreshFailure(handler: () => void): void {
  failureHandler = handler
}

export function ensureRefreshed(): Promise<string> {
  if (!inFlight) {
    inFlight = doRefresh().finally(() => { inFlight = null })
  }
  return inFlight
}

async function doRefresh(): Promise<string> {
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`refresh failed: ${res.status}`)
    const data = await res.json() as AuthResponse
    tokenManager.set(data.access_token)
    return data.access_token
  } catch (err) {
    failureHandler?.()
    throw err
  }
}
