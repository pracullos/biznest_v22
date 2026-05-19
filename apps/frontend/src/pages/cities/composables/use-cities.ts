import { useState, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listCitiesCitiesGet, createCityCitiesPost } from '@networking/api/generated/cities/cities'
import { createAssignmentLguAssignmentsPost } from '@networking/api/generated/lgu-assignments/lgu-assignments'
import type { CityCreate } from '@networking/api/model/cityCreate'
import type { CityResponse } from '@networking/api/model/cityResponse'
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

  const { data: cities = [], isLoading } = useQuery({
    queryKey: ['/cities/'],
    queryFn:  () => listCitiesCitiesGet().then(r => r.data),
  })

  const createCity = useMutation({
    mutationFn: (data: CityCreate) => createCityCitiesPost(data),
    onSuccess: async res => {
      await queryClient.invalidateQueries({ queryKey: ['/cities/'] })
      if (isLgu && auth) {
        await createAssignmentLguAssignmentsPost({ user_id: auth.user.id, city_id: res.data.id })
        await queryClient.invalidateQueries({ queryKey: ['/lgu-assignments/'] })
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
