import { $api } from '@/lib/api-client'

export function useSubscription() {
  const { data: subscription, isLoading: subLoading } = $api.useQuery('get', '/subscriptions/me', undefined, {
    retry: false,
  })

  const { data: access = [], isLoading: accessLoading } = $api.useQuery('get', '/city-access/me')

  const { data: allCities = [], isLoading: citiesLoading } = $api.useQuery('get', '/cities/')

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
