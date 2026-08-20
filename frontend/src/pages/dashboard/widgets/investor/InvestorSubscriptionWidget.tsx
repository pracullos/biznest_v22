import { CreditCard } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getMySubscriptionSubscriptionsMeGet } from '@networking/api/generated/subscriptions/subscriptions'
import { useAuthContext } from '@/context/auth.context'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export function InvestorSubscriptionWidget() {
  const { state } = useAuthContext()
  const auth = state.state === 'AUTHENTICATED' ? state : null
  const cityIds = auth?.city_ids ?? []

  const { data, isLoading } = useQuery({
    queryKey: ['/subscriptions/me'],
    queryFn: () => getMySubscriptionSubscriptionsMeGet().then(r => r.data),
    enabled: !!auth,
    retry: false,
  })

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base">Subscription</CardTitle>
          <CardDescription>Your current plan</CardDescription>
        </div>
        {data && (
          <Badge variant="secondary" className="capitalize">
            {data.plan.name}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            Loading subscription…
          </div>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">No active subscription.</p>
        ) : (
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <CreditCard className="size-3.5 text-muted-foreground" />
              <span>
                {cityIds.length} / {data.plan.max_cities ?? '∞'} cities used
              </span>
            </div>
            {data.expires_at && (
              <span>
                Expires {new Date(data.expires_at).toLocaleDateString()}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}