import { $api } from '@/lib/api-client'
import { useAuthContext } from '@/context/auth.context'
import { useCityContext } from '@/context/city.context'

export function useDashboardData() {
  const { state } = useAuthContext()
  const { selectedCity } = useCityContext()
  const auth = state.state === 'AUTHENTICATED' ? state : null
  const cityId = selectedCity?.id ?? ''

  const { data: stats, isLoading: statsLoading } = $api.useQuery('get', '/cities/{city_id}/stats', {
    params: { path: { city_id: cityId } },
  }, { enabled: !!cityId })

  const { data: establishments = [], isLoading: establishmentsLoading } = $api.useQuery('get', '/cities/{city_id}/establishments', {
    params: { path: { city_id: cityId } },
  }, { enabled: !!cityId })

  const { data: subscription } = $api.useQuery('get', '/subscriptions/me', undefined, {
    enabled: auth?.role_name === 'investor',
    retry: false,
  })

  const dataLoading = statsLoading || establishmentsLoading

  return {
    user: auth?.user ?? null,
    role_name: auth?.role_name ?? null,
    cityIds: auth?.city_ids ?? [],
    selectedCity,
    hazardCount: stats?.hazard_count ?? 0,
    zoningCount: stats?.zoning_count ?? 0,
    establishmentCount: stats?.establishment_count ?? 0,
    alertCount: stats?.alert_count ?? 0,
    establishments,
    subscription,
    dataLoading,
    statsLoaded: !statsLoading && !!stats,
  }
}
