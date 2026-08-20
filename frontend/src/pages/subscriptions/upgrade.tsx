import { Spinner } from '@/components/ui/spinner'
import { PlanCard } from './components/plan-card'
import { useUpgrade } from './composables/use-upgrade'

export function UpgradePage() {
  const { plans, subscription, loading } = useUpgrade()

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        Loading plans…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Choose Your Plan</h1>
        <p className="text-sm text-muted-foreground max-w-lg">
          Unlock geo-intelligence across more cities. Each plan includes hazard overlays,
          zoning maps, and establishment data — scale up as your portfolio grows.
        </p>
      </div>

      {plans.length === 0 ? (
        <p className="text-sm text-muted-foreground">No plans available.</p>
      ) : (
        <div className="grid gap-6 pt-3 sm:grid-cols-2 lg:grid-cols-3 items-start">
          {plans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={subscription?.plan_id === plan.id}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Need a custom arrangement?{' '}
        <a href="mailto:hello@biznest.ph" className="underline underline-offset-2 hover:text-foreground transition-colors">
          Contact our team
        </a>{' '}
        and we'll find the right fit.
      </p>
    </div>
  )
}