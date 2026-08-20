import { useQuery } from '@tanstack/react-query'
import { getMySubscriptionSubscriptionsMeGet } from '@networking/api/generated/subscriptions/subscriptions'
import { listEstablishmentsCitiesCityIdEstablishmentsGet } from '@networking/api/generated/establishments/establishments'
import { useGetCityStats } from '@networking/api/cities-stats'
import { useAuthContext } from '@/context/auth.context'
import { useCityContext } from '@/context/city.context'

export function useDashboardData() {
  const { state } = useAuthContext()
  const { selectedCity } = useCityContext()
  const auth = state.state === 'AUTHENTICATED' ? state : null
  const cityId = selectedCity?.id ?? null

  const { data: statsData, isLoading: statsLoading } = useGetCityStats(cityId)
  const stats = statsData?.data

  const { data: establishments = [], isLoading: establishmentsLoading } = useQuery({
    queryKey: [`/cities/${cityId}/establishments`],
    queryFn: () => listEstablishmentsCitiesCityIdEstablishmentsGet(cityId!).then(r => r.data),
    enabled: !!cityId,
  })

  const { data: subscription } = useQuery({
    queryKey: ['/subscriptions/me'],
    queryFn: () => getMySubscriptionSubscriptionsMeGet().then(r => r.data),
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
