import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { listCitiesCitiesGet, createCityCitiesPost } from '@networking/api/generated/cities/cities'
import { myAccessCityAccessMeGet, grantAccessCityAccessPost } from '@networking/api/generated/city-access/city-access'
import { listAssignmentsLguAssignmentsGet, createAssignmentLguAssignmentsPost } from '@networking/api/generated/lgu-assignments/lgu-assignments'
import { getMySubscriptionSubscriptionsMeGet } from '@networking/api/generated/subscriptions/subscriptions'
import type { CityCreate } from '@networking/api/model/cityCreate'
import { useAuthContext } from '@/context/auth.context'

export function useCitySetup() {
  const { state, selectCity, signOut } = useAuthContext()
  const auth = state.state === 'AUTHENTICATED' ? state : null
  const queryClient = useQueryClient()
  const router = useRouter()

  const { data: allCities = [], isLoading: citiesLoading } = useQuery({
    queryKey: ['/cities/'],
    queryFn: () => listCitiesCitiesGet().then(r => r.data),
  })

  const { data: myAccess = [], isLoading: accessLoading } = useQuery({
    queryKey: ['/city-access/me'],
    queryFn: () => myAccessCityAccessMeGet().then(r => r.data),
    enabled: auth?.role_name === 'investor',
  })

  const { data: myAssignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['/lgu-assignments/'],
    queryFn: () => listAssignmentsLguAssignmentsGet().then(r => r.data),
    enabled: auth?.role_name === 'lgu_admin',
  })

  const { data: subscription } = useQuery({
    queryKey: ['/subscriptions/me'],
    queryFn: () => getMySubscriptionSubscriptionsMeGet().then(r => r.data),
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

  const subscribeCity = useMutation({
    mutationFn: (cityId: string) =>
      grantAccessCityAccessPost({ user_id: auth!.user.id, city_id: cityId }),
    onSuccess: async (_, cityId) => {
      await queryClient.invalidateQueries({ queryKey: ['/city-access/me'] })
      await enterCity(cityId)
    },
  })

  const claimCity = useMutation({
    mutationFn: (cityId: string) =>
      createAssignmentLguAssignmentsPost({ user_id: auth!.user.id, city_id: cityId }),
    onSuccess: async (_, cityId) => {
      await queryClient.invalidateQueries({ queryKey: ['/lgu-assignments/'] })
      await enterCity(cityId)
    },
  })

  const createCity = useMutation({
    mutationFn: (data: CityCreate) => createCityCitiesPost(data),
    onSuccess: async res => {
      await queryClient.invalidateQueries({ queryKey: ['/cities/'] })
      const newCity = res.data
      await createAssignmentLguAssignmentsPost({ user_id: auth!.user.id, city_id: newCity.id })
      await queryClient.invalidateQueries({ queryKey: ['/lgu-assignments/'] })
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