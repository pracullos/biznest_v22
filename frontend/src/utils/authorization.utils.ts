import type { Permission } from '@/config/permissions'

/**
 * Check if a permission set includes a specific permission.
 * Use in page components and guards where you have the permissions array directly.
 */
export function can(permissions: string[], permission: Permission): boolean {
  return permissions.includes(permission)
}

/**
 * Check if a permission set includes ALL of the given permissions.
 */
export function canAll(permissions: string[], required: Permission[]): boolean {
  return required.every(p => permissions.includes(p))
}

/**
 * Check if a permission set includes ANY of the given permissions.
 */
export function canAny(permissions: string[], required: Permission[]): boolean {
  return required.some(p => permissions.includes(p))
}

/**
 * Check if the user's role matches a given role slug.
 */
export function isRole(userRole: string | null | undefined, role: string): boolean {
  return userRole === role
}

/**
 * Check if the user's role is one of the given role slugs.
 */
export function isAnyRole(userRole: string | null | undefined, roles: string[]): boolean {
  return userRole !== null && userRole !== undefined && roles.includes(userRole)
}
