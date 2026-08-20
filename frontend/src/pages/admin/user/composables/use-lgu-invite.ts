import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import axios from 'axios'
import type { AxiosError } from 'axios'
import type { LguInviteResponse } from '@networking/api/model/lguInviteResponse'

interface RegionOption { id: string; name: string }
interface ProvinceOption { id: string; name: string }
interface CityOption { id: string; name: string }

function getErrorMessage(err: unknown): string {
  const axiosErr = err as AxiosError<{ detail?: string | Array<{ msg: string }> }>
  const detail = axiosErr?.response?.data?.detail
  if (Array.isArray(detail)) return detail.map(e => e.msg).join('; ')
  if (typeof detail === 'string') return detail
  return 'Something went wrong. Please try again.'
}

export function useLguInvite() {
  const [email, setEmail] = useState('')
  const [regionId, setRegionIdState] = useState<string | null>(null)
  const [provinceId, setProvinceIdState] = useState<string | null>(null)
  const [cityId, setCityIdState] = useState<string | null>(null)
  const [result, setResult] = useState<LguInviteResponse | null>(null)

  function setRegionId(id: string | null) {
    setRegionIdState(id)
    setProvinceIdState(null)
    setCityIdState(null)
  }

  function setProvinceId(id: string | null) {
    setProvinceIdState(id)
    setCityIdState(null)
  }

  function setCityId(id: string | null) {
    setCityIdState(id)
  }

  const { data: regions = [], isLoading: regionsLoading } = useQuery<RegionOption[]>({
    queryKey: ['/regions/'],
    queryFn: () =>
      axios.get<RegionOption[]>('/regions/').then(r => r.data),
  })

  const { data: provinces = [], isLoading: provincesLoading } = useQuery<ProvinceOption[]>({
    queryKey: ['/regions', regionId, 'provinces'],
    queryFn: () =>
      axios.get<ProvinceOption[]>(`/regions/${regionId}/provinces`).then(r => r.data),
    enabled: !!regionId,
  })

  const { data: cities = [], isLoading: citiesLoading } = useQuery<CityOption[]>({
    queryKey: ['/provinces', provinceId, 'cities'],
    queryFn: () =>
      axios.get<CityOption[]>(`/provinces/${provinceId}/cities`).then(r => r.data),
    enabled: !!provinceId,
  })

  const {
    mutateAsync: sendInvite,
    isPending: sending,
    error: mutationError,
    reset: resetMutation,
  } = useMutation({
    mutationFn: ({ email, city_id }: { email: string; city_id: string }) =>
      axios.post<LguInviteResponse>('/users/lgu/invite', { email, city_id }).then(r => r.data),
    onSuccess: (data) => setResult(data),
  })

  const error = mutationError ? getErrorMessage(mutationError) : null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!cityId) return
    await sendInvite({ email, city_id: cityId })
  }

  function reset() {
    setEmail('')
    setRegionIdState(null)
    setProvinceIdState(null)
    setCityIdState(null)
    setResult(null)
    resetMutation()
  }

  return {
    email, setEmail,
    regionId, setRegionId,
    provinceId, setProvinceId,
    cityId, setCityId,
    regions, regionsLoading,
    provinces, provincesLoading,
    cities, citiesLoading,
    sending,
    error,
    success: !!result,
    result,
    handleSubmit,
    reset,
  }
}