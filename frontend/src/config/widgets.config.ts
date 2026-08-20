import type { ComponentType } from 'react'
import { PlatformStatsWidget } from '@/pages/dashboard/widgets/admin/PlatformStatsWidget'
import { LguCityStatsWidget } from '@/pages/dashboard/widgets/lgu/LguCityStatsWidget'
import { LguAlertsWidget } from '@/pages/dashboard/widgets/lgu/LguAlertsWidget'
import { InvestorCityStatsWidget } from '@/pages/dashboard/widgets/investor/InvestorCityStatsWidget'
import { InvestorHazardWidget } from '@/pages/dashboard/widgets/investor/InvestorHazardWidget'
import { InvestorSubscriptionWidget } from '@/pages/dashboard/widgets/investor/InvestorSubscriptionWidget'

export type WidgetRole = 'investor' | 'lgu_admin' | 'admin'

export interface WidgetDefinition {
  id: string
  roles: WidgetRole[]
  component: ComponentType
  colSpan?: 1 | 2 | 3
  requiresCity?: boolean
}

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  {
    id: 'platform-stats',
    roles: ['admin'],
    component: PlatformStatsWidget,
    colSpan: 3,
  },
  {
    id: 'lgu-city-stats',
    roles: ['lgu_admin'],
    component: LguCityStatsWidget,
    colSpan: 3,
    requiresCity: true,
  },
  {
    id: 'lgu-alerts',
    roles: ['lgu_admin'],
    component: LguAlertsWidget,
    colSpan: 2,
    requiresCity: true,
  },
  {
    id: 'investor-city-stats',
    roles: ['investor'],
    component: InvestorCityStatsWidget,
    colSpan: 2,
    requiresCity: true,
  },
  {
    id: 'investor-hazard',
    roles: ['investor'],
    component: InvestorHazardWidget,
    colSpan: 1,
    requiresCity: true,
  },
  {
    id: 'investor-subscription',
    roles: ['investor'],
    component: InvestorSubscriptionWidget,
    colSpan: 1,
  },
]

export function getWidgetsForRole(
  role: string | null,
  cityId: string | null,
): WidgetDefinition[] {
  if (!role) return []

  return WIDGET_REGISTRY.filter(widget => {
    const roleMatch = widget.roles.includes(role as WidgetRole)
    if (!roleMatch) return false
    if (widget.requiresCity && !cityId) return false
    return true
  })
}