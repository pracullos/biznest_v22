import { useState } from 'react'
import type { FormEvent } from 'react'
import { $api } from '@/lib/api-client'
import type { LguInviteResponse } from '@/types/api-aliases'

function getErrorMessage(err: unknown): string {
  const detail = (err as { detail?: string | Array<{ msg: string }> } | undefined)?.detail
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

  const { data: regions = [], isLoading: regionsLoading } = $api.useQuery('get', '/regions/')

  const { data: provinces = [], isLoading: provincesLoading } = $api.useQuery('get', '/regions/{region_id}/provinces', {
    params: { path: { region_id: regionId ?? '' } },
  }, {
    enabled: !!regionId,
  })

  const { data: cities = [], isLoading: citiesLoading } = $api.useQuery('get', '/provinces/{province_id}/cities', {
    params: { path: { province_id: provinceId ?? '' } },
  }, {
    enabled: !!provinceId,
  })

  const {
    mutateAsync: sendInviteRaw,
    isPending: sending,
    error: mutationError,
    reset: resetMutation,
  } = $api.useMutation('post', '/users/lgu/invite', {
    onSuccess: (data) => setResult(data),
  })

  const error = mutationError ? getErrorMessage(mutationError) : null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!cityId) return
    await sendInviteRaw({ body: { email, city_id: cityId } })
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
