import { createFileRoute, redirect } from '@tanstack/react-router'
import { verifyLguInvitationUsersLguVerifyInvitationGet } from '@networking/api/generated/users/users'
import { getCityCitiesCityIdGet } from '@networking/api/generated/cities/cities'
import { LguRegistrationPage } from '@/pages/lgu/registration/registration'
import type { CityResponse } from '@networking/api/model/cityResponse'
import type { AxiosError } from 'axios'

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

    let cityId: string | null = null
    try {
      const res = await verifyLguInvitationUsersLguVerifyInvitationGet({
        token: search.token,
        email: search.email,
      })
      if (!res.data.valid) {
        return { valid: false, error: 'This invitation link is invalid.' }
      }
      cityId = res.data.city_id ?? null
    } catch (err) {
      const axiosErr = err as AxiosError<{ detail?: string }>
      const status = axiosErr.response?.status
      const detail = axiosErr.response?.data?.detail
      if (status === 410) return { valid: false, error: detail ?? 'This invitation has already been used or has expired.' }
      if (status === 404) return { valid: false, error: 'Invitation not found. Check your link or request a new one.' }
      return { valid: false, error: detail ?? 'Unable to verify invitation. Please try again.' }
    }

    let city: CityResponse | null = null
    if (cityId) {
      try {
        const res = await getCityCitiesCityIdGet(cityId)
        city = res.data
      } catch {
        // city display is non-critical
      }
    }

    return { valid: true, city }
  },
  component: LguRegistrationPage,
})