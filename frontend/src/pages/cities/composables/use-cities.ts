import { useState, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { $api, fetchClient } from '@/lib/api-client'
import type { CityResponse } from '@/types/api-aliases'
import { useAuthContext } from '@/context/auth.context'
import { useCityContext } from '@/context/city.context'

const PAGE_SIZE = 15

export function useCities() {
  const { state }    = useAuthContext()
  const { selectCity } = useCityContext()
  const navigate     = useNavigate()
  const queryClient  = useQueryClient()

  const auth  = state.state === 'AUTHENTICATED' ? state : null
  const isLgu = auth?.role_name === 'lgu_admin'

  const [search, setSearch] = useState('')
  const [page,   setPage]   = useState(1)

  const { data: cities = [], isLoading } = $api.useQuery('get', '/cities/')

  const createCity = $api.useMutation('post', '/cities/', {
    onSuccess: async city => {
      await queryClient.invalidateQueries({ queryKey: $api.queryOptions('get', '/cities/').queryKey })
      if (isLgu && auth) {
        await fetchClient.POST('/lgu-assignments/', { body: { user_id: auth.user.id, city_id: city.id } })
        await queryClient.invalidateQueries({ queryKey: $api.queryOptions('get', '/lgu-assignments/').queryKey })
      }
    },
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return cities
    return cities.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.province?.toLowerCase().includes(q) ||
        c.region?.toLowerCase().includes(q),
    )
  }, [cities, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const pageSlice  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function openOnMap(city: CityResponse) {
    selectCity(city)
    void navigate({ to: '/map' as never })
  }

  function viewDetail(city: CityResponse) {
    void navigate({ to: '/cities/$cityId' as never, params: { cityId: city.id } as never })
  }

  function handleSearch(value: string) {
    setSearch(value)
    setPage(1)
  }

  return {
    isLgu,
    cities,
    isLoading,
    createCity,
    search,
    page,
    setPage,
    filtered,
    totalPages,
    safePage,
    pageSlice,
    openOnMap,
    viewDetail,
    handleSearch,
  }
}
