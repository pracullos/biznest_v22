import { useQuery } from '@tanstack/react-query'
import {
  listPlansSubscriptionsPlansGet,
  getMySubscriptionSubscriptionsMeGet,
} from '@networking/api/generated/subscriptions/subscriptions'

export function useUpgrade() {
  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['/subscriptions/plans'],
    queryFn: () => listPlansSubscriptionsPlansGet().then(r => r.data),
  })

  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ['/subscriptions/me'],
    queryFn: () => getMySubscriptionSubscriptionsMeGet().then(r => r.data),
    retry: false,
  })

  return {
    plans,
    subscription,
    loading: plansLoading || subLoading,
  }
}