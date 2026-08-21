import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { $api, fetchClient, unwrap } from '@/lib/api-client'
import { useAuthContext } from '@/context/auth.context'

export function useCitySetup() {
  const { state, selectCity, signOut } = useAuthContext()
  const auth = state.state === 'AUTHENTICATED' ? state : null
  const queryClient = useQueryClient()
  const router = useRouter()

  const { data: allCities = [], isLoading: citiesLoading } = $api.useQuery('get', '/cities/')

  const { data: myAccess = [], isLoading: accessLoading } = $api.useQuery('get', '/city-access/me', undefined, {
    enabled: auth?.role_name === 'investor',
  })

  const { data: myAssignments = [], isLoading: assignmentsLoading } = $api.useQuery('get', '/lgu-assignments/', undefined, {
    enabled: auth?.role_name === 'lgu_admin',
  })

  const { data: subscription } = $api.useQuery('get', '/subscriptions/me', undefined, {
    enabled: auth?.role_name === 'investor',
    retry: false,
  })

  const role = auth?.role_name ?? null

  const myCityIds = role === 'investor'
    ? myAccess.map(a => a.city_id)
    : role === 'lgu_admin'
      ? myAssignments.filter(a => a.user_id === auth?.user.id).map(a => a.city_id)
      : []

  const myCities = allCities.filter(c => myCityIds.includes(c.id))
  const availableCities = allCities.filter(c => !myCityIds.includes(c.id))

  const maxCities = subscription?.plan.max_cities ?? null
  const atLimit = maxCities !== null && myCityIds.length >= maxCities

  async function enterCity(cityId: string) {
    // selectCity: investor → calls /city-access/select/{cityId}, gets JWT with city_id
    //             lgu_admin → sets city_id in auth state directly
    await selectCity(cityId)
    void router.navigate({ to: '/dashboard' })
  }

  // ── Mutations ──────────────────────────────────────────────────────────────
  // subscribeCity/claimCity take a bare cityId (matching CityCard's onAction contract)

  const subscribeCity = useMutation({
    mutationFn: async (cityId: string) =>
      unwrap(await fetchClient.POST('/city-access/', { body: { user_id: auth!.user.id, city_id: cityId } })),
    onSuccess: async (_, cityId) => {
      await queryClient.invalidateQueries({ queryKey: $api.queryOptions('get', '/city-access/me').queryKey })
      await enterCity(cityId)
    },
  })

  const claimCity = useMutation({
    mutationFn: async (cityId: string) =>
      unwrap(await fetchClient.POST('/lgu-assignments/', { body: { user_id: auth!.user.id, city_id: cityId } })),
    onSuccess: async (_, cityId) => {
      await queryClient.invalidateQueries({ queryKey: $api.queryOptions('get', '/lgu-assignments/').queryKey })
      await enterCity(cityId)
    },
  })

  const createCity = $api.useMutation('post', '/cities/', {
    onSuccess: async newCity => {
      await queryClient.invalidateQueries({ queryKey: $api.queryOptions('get', '/cities/').queryKey })
      await fetchClient.POST('/lgu-assignments/', { body: { user_id: auth!.user.id, city_id: newCity.id } })
      await queryClient.invalidateQueries({ queryKey: $api.queryOptions('get', '/lgu-assignments/').queryKey })
      await enterCity(newCity.id)
    },
  })

  const loading = citiesLoading || accessLoading || assignmentsLoading

  return {
    role,
    user: auth?.user ?? null,
    myCities,
    availableCities,
    subscription,
    atLimit,
    maxCities,
    usedSlots: myCityIds.length,
    loading,
    subscribeCity,
    claimCity,
    createCity,
    enterCity,
    signOut,
  }
}
