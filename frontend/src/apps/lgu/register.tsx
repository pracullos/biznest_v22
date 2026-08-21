import { createFileRoute, redirect } from '@tanstack/react-router'
import { fetchClient } from '@/lib/api-client'
import { LguRegistrationPage } from '@/pages/lgu/registration/registration'
import type { CityResponse } from '@/types/api-aliases'

export type LguRegisterLoaderData = {
  valid: true
  city: CityResponse | null
} | {
  valid: false
  error: string
}

export const Route = createFileRoute('/lgu/register')({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : '',
    email: typeof search.email === 'string' ? search.email : '',
  }),
  beforeLoad: ({ search }) => {
    if (!search.token || !search.email) {
      throw redirect({ to: '/login', replace: true })
    }
  },
  loader: async ({ location }): Promise<LguRegisterLoaderData> => {
    const search = location.search as { token: string; email: string }

    const verify = await fetchClient.GET('/users/lgu/verify-invitation', {
      params: { query: { token: search.token, email: search.email } },
    })
    if (verify.error !== undefined) {
      const status = verify.response.status
      const detail = (verify.error as { detail?: string } | undefined)?.detail
      if (status === 410) return { valid: false, error: detail ?? 'This invitation has already been used or has expired.' }
      if (status === 404) return { valid: false, error: 'Invitation not found. Check your link or request a new one.' }
      return { valid: false, error: detail ?? 'Unable to verify invitation. Please try again.' }
    }
    if (!verify.data.valid) {
      return { valid: false, error: 'This invitation link is invalid.' }
    }
    const cityId = verify.data.city_id ?? null

    let city: CityResponse | null = null
    if (cityId) {
      const cityRes = await fetchClient.GET('/cities/{city_id}', { params: { path: { city_id: cityId } } })
      city = cityRes.data ?? null
      // city display is non-critical — cityRes.error is silently ignored
    }

    return { valid: true, city }
  },
  component: LguRegistrationPage,
})