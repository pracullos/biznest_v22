import { Link } from '@tanstack/react-router'
import { CreditCard, MapPin, CheckCircle2, ArrowUpCircle } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useSubscription } from './composables/use-subscription'

export function SubscriptionsPage() {
  const { subscription, accessibleCities, maxCities, usedSlots, slotsLeft, loading } =
    useSubscription()

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        Loading subscription…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Subscription</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your city access and subscription plan
        </p>
      </div>

      {!subscription ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No active subscription found.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CreditCard className="size-5 text-muted-foreground" />
                  <CardTitle className="text-base">Current Plan</CardTitle>
                </div>
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <Link to="/subscriptions/upgrade">
                    <ArrowUpCircle className="size-4" />
                    Upgrade
                  </Link>
                </Button>
              </div>
              <CardDescription>Your active investment platform subscription</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="text-sm capitalize px-3 py-1">
                  {subscription.plan.name}
                </Badge>
                <CheckCircle2 className="size-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Active</span>
              </div>

              {subscription.expires_at && (
                <p className="text-sm text-muted-foreground">
                  Expires: {new Date(subscription.expires_at).toLocaleDateString()}
                </p>
              )}

              {maxCities !== null && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">City access</span>
                    <span className="font-medium">
                      {usedSlots} / {maxCities}
                    </span>
                  </div>
                  <Progress value={(usedSlots / maxCities) * 100} className="h-2" />
                  {slotsLeft !== null && slotsLeft <= 2 && slotsLeft > 0 && (
                    <p className="text-xs text-amber-600">
                      {slotsLeft} slot{slotsLeft !== 1 ? 's' : ''} remaining
                    </p>
                  )}
                  {slotsLeft === 0 && (
                    <p className="text-xs text-destructive">City limit reached</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Accessible Cities</CardTitle>
              <CardDescription>
                Cities included in your subscription
              </CardDescription>
            </CardHeader>
            <CardContent>
              {accessibleCities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No cities in your subscription yet.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {accessibleCities.map(city => (
                    <Link
                      key={city.id}
                      to="/map"
                      className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent transition-colors"
                    >
                      <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">{city.name}</span>
                      {city.province && (
                        <span className="ml-auto text-xs text-muted-foreground shrink-0">
                          {city.province}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
