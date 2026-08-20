import { useAuthContext } from '@/context/auth.context'
import type { Permission } from '@/config/permissions'
import { can, canAll, canAny, isRole, isAnyRole } from '@/utils/authorization.utils'

/** Returns true if the authenticated user has the given permission. */
export function usePermission(permission: Permission): boolean {
  const { state } = useAuthContext()
  if (state.state !== 'AUTHENTICATED') return false
  return can(state.permissions, permission)
}

/** Returns true if the authenticated user has ALL of the given permissions. */
export function usePermissions(permissions: Permission[]): boolean {
  const { state } = useAuthContext()
  if (state.state !== 'AUTHENTICATED') return false
  return canAll(state.permissions, permissions)
}

/** Returns true if the authenticated user has ANY of the given permissions. */
export function useAnyPermission(permissions: Permission[]): boolean {
  const { state } = useAuthContext()
  if (state.state !== 'AUTHENTICATED') return false
  return canAny(state.permissions, permissions)
}

/** Returns the authenticated user's role slug, or null if unauthenticated. */
export function useRole(): string | null {
  const { state } = useAuthContext()
  if (state.state !== 'AUTHENTICATED') return null
  return state.role_name
}

/** Returns true if the authenticated user's role matches the given slug. */
export function useIsRole(role: string): boolean {
  const { state } = useAuthContext()
  if (state.state !== 'AUTHENTICATED') return false
  return isRole(state.role_name, role)
}

/** Returns true if the authenticated user's role is one of the given slugs. */
export function useIsAnyRole(roles: string[]): boolean {
  const { state } = useAuthContext()
  if (state.state !== 'AUTHENTICATED') return false
  return isAnyRole(state.role_name, roles)
}

/** Returns the city IDs the authenticated user can access. */
export function useCityIds(): string[] {
  const { state } = useAuthContext()
  if (state.state !== 'AUTHENTICATED') return []
  return state.city_ids
}
