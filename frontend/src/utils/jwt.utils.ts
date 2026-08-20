import { tokenManager } from '@/lib/axios'

export interface TokenClaims {
  exp?: number
  role?: string
  role_id?: string
  city_id?: string
}

export function decodeTokenClaims(token: string): TokenClaims {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(b64)) as TokenClaims
  } catch {
    return {}
  }
}

export function getTokenExpiry(token: string): number | null {
  const claims = decodeTokenClaims(token)
  return typeof claims.exp === 'number' ? claims.exp : null
}

/** Reads role slug and role_id from the in-memory access token — no API call. */
export function resolveRoleFromToken(): { role_name: string | null; role_id: string | null } {
  const token = tokenManager.get()
  if (!token) return { role_name: null, role_id: null }
  const claims = decodeTokenClaims(token)
  return {
    role_name: typeof claims.role     === 'string' ? claims.role     : null,
    role_id:   typeof claims.role_id  === 'string' ? claims.role_id  : null,
  }
}

/** investor → /city-setup; admin / lgu_admin / superuser → /dashboard */
export function postAuthRoute(role_name: string | null, is_superuser: boolean): string {
  if (is_superuser || role_name === 'admin' || role_name === 'lgu_admin') return '/dashboard'
  return '/city-setup'
}
