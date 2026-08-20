export const PERMISSION = {
  MANAGE_CITY:         'manage:city',
  ZONING_READ:         'zoning:read',
  ZONING_WRITE:        'zoning:write',
  HAZARD_READ:         'hazard:read',
  HAZARD_WRITE:        'hazard:write',
  ESTABLISHMENT_READ:  'establishment:read',
  ESTABLISHMENT_WRITE: 'establishment:write',
  ALERTS_READ:         'alert:read',
  ALERTS_WRITE:        'alert:write',
  ANALYTICS_VIEW:      'analytics:view',
  LOCATION_SAVE:       'location:save',
  MANAGE_USER:         'manage:user',
  MANAGE_ROLE:         'manage:role',
  VIEW_MAP:            'view:map',
  MANAGE_SUBSCRIPTION: 'manage:subscription',
  MANAGE_LOGS:         'manage:logs',
} as const

export type Permission = (typeof PERMISSION)[keyof typeof PERMISSION]

/** Every permission slug — used for superusers who bypass role checks. */
export const ALL_PERMISSIONS: string[] = Object.values(PERMISSION)

/**
 * Fallback permission map per role — mirrors backend core/seed.py.
 * Primary source is GET /roles/{id} during session restore.
 * This map is used only when that call fails (network error, backend down).
 */
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  investor: [
    PERMISSION.ZONING_READ,
    PERMISSION.HAZARD_READ,
    PERMISSION.ESTABLISHMENT_READ,
    PERMISSION.ANALYTICS_VIEW,
    PERMISSION.LOCATION_SAVE,
    PERMISSION.VIEW_MAP,
    PERMISSION.MANAGE_SUBSCRIPTION,
  ],
  lgu_admin: [
    PERMISSION.MANAGE_CITY,
    PERMISSION.ZONING_READ,        PERMISSION.ZONING_WRITE,
    PERMISSION.HAZARD_READ,        PERMISSION.HAZARD_WRITE,
    PERMISSION.ESTABLISHMENT_READ, PERMISSION.ESTABLISHMENT_WRITE,
    PERMISSION.ALERTS_READ,        PERMISSION.ALERTS_WRITE,
    PERMISSION.ANALYTICS_VIEW,
    PERMISSION.LOCATION_SAVE,
    PERMISSION.VIEW_MAP,
    PERMISSION.MANAGE_LOGS,
  ],
  admin: ALL_PERMISSIONS,
}
