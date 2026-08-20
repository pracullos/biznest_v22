import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  Bookmark,
  Building2,
  CreditCard,
  Database,
  LayoutDashboard,
  Map,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { PERMISSION } from './permissions'

export interface NavItem {
  title: string
  to: string
  icon: LucideIcon
  /** If set, only show this item when the user has this permission. */
  permission?: string
}

export interface NavSection {
  title?: string
  items: NavItem[]
}

/**
 * Single source of truth for all navigation items.
 * Each item is optionally gated by a permission slug.
 * `getNavSections()` filters this list to what the current user may see.
 */
const ALL_NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { title: 'Dashboard',  to: '/dashboard', icon: LayoutDashboard },
      { title: 'Cities',     to: '/cities',    icon: Building2, permission: PERMISSION.MANAGE_CITY },
      { title: 'Map',        to: '/map',       icon: Map,      permission: PERMISSION.VIEW_MAP },
    ],
  },
  {
    items: [
      { title: 'Subscription',    to: '/subscriptions',   icon: CreditCard, permission: PERMISSION.MANAGE_SUBSCRIPTION },
      { title: 'Saved Locations', to: '/saved-locations', icon: Bookmark, permission: PERMISSION.LOCATION_SAVE },
    ],
  },
  {
    title: 'City Management',
    items: [
      { title: 'Alerts', to: '/alerts', icon: Bell,     permission: PERMISSION.ALERTS_READ },
      { title: 'Data',   to: '/data',   icon: Database, permission: PERMISSION.HAZARD_WRITE },
    ],
  },
  {
    title: 'System',
    items: [
      { title: 'Audit Logs', to: '/audit-logs', icon: ScrollText, permission: PERMISSION.MANAGE_LOGS },
      { title: 'Settings',   to: '/settings',   icon: Settings,   permission: PERMISSION.MANAGE_CITY },
    ],
  },
  {
    title: 'Administration',
    items: [
      { title: 'User Management',   to: '/admin/user-management',  icon: Users,       permission: PERMISSION.MANAGE_USER },
      { title: 'Role & Permissions', to: '/admin/role-permissions', icon: ShieldCheck, permission: PERMISSION.MANAGE_ROLE },
    ],
  },
]

/**
 * Returns the nav sections visible to a user with the given permission set.
 * Sections with no visible items are dropped entirely.
 */
export function getNavSections(permissions: string[]): NavSection[] {
  const permSet = new Set(permissions)
  return ALL_NAV_SECTIONS
    .map(section => ({
      ...section,
      items: section.items.filter(item => !item.permission || permSet.has(item.permission)),
    }))
    .filter(section => section.items.length > 0)
}

export { Map as BrandIcon }