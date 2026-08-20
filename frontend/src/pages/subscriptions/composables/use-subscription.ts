import { useQuery } from '@tanstack/react-query'
import { getMySubscriptionSubscriptionsMeGet } from '@networking/api/generated/subscriptions/subscriptions'
import { listCitiesCitiesGet } from '@networking/api/generated/cities/cities'
import { myAccessCityAccessMeGet } from '@networking/api/generated/city-access/city-access'

export function useSubscription() {
  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ['/subscriptions/me'],
    queryFn: () => getMySubscriptionSubscriptionsMeGet().then(r => r.data),
    retry: false,
  })

  const { data: access = [], isLoading: accessLoading } = useQuery({
    queryKey: ['/city-access/me'],
    queryFn: () => myAccessCityAccessMeGet().then(r => r.data),
  })

  const { data: allCities = [], isLoading: citiesLoading } = useQuery({
    queryKey: ['/cities/'],
    queryFn: () => listCitiesCitiesGet().then(r => r.data),
  })

  const accessedCityIds = access.map(a => a.city_id)
  const accessibleCities = allCities.filter(c => accessedCityIds.includes(c.id))

  const maxCities = subscription?.plan.max_cities ?? null
  const usedSlots = accessibleCities.length
  const slotsLeft = maxCities !== null ? maxCities - usedSlots : null

  return {
    subscription,
    access,
    accessibleCities,
    allCities,
    maxCities,
    usedSlots,
    slotsLeft,
    loading: subLoading || accessLoading || citiesLoading,
  }
}
