import { $api } from '@/lib/api-client'

export function useUpgrade() {
  const { data: plans = [], isLoading: plansLoading } = $api.useQuery('get', '/subscriptions/plans')

  const { data: subscription, isLoading: subLoading } = $api.useQuery('get', '/subscriptions/me', undefined, {
    retry: false,
  })

  return {
    plans,
    subscription,
    loading: plansLoading || subLoading,
  }
}
