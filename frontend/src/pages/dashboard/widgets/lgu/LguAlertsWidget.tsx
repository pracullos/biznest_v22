import { Bell } from 'lucide-react'
import { useListAlertsCitiesCityIdAlertsGet } from '@networking/api/generated/alerts/alerts'
import { useCityContext } from '@/context/city.context'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

const ALERT_TYPE_VARIANT: Record<string, 'destructive' | 'secondary' | 'outline'> = {
  danger: 'destructive',
  warning: 'secondary',
  info: 'outline',
}

function getAlertVariant(type: string | null): 'destructive' | 'secondary' | 'outline' {
  if (!type) return 'outline'
  return ALERT_TYPE_VARIANT[type.toLowerCase()] ?? 'outline'
}

export function LguAlertsWidget() {
  const { selectedCity } = useCityContext()
  const cityId = selectedCity?.id ?? ''

  const { data, isLoading } = useListAlertsCitiesCityIdAlertsGet(cityId)

  const alerts = data?.data ?? []
  const recent = alerts.slice(0, 5)

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recent Alerts</CardTitle>
        <CardDescription>Last 5 alerts for {selectedCity?.name ?? 'this city'}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            Loading alerts…
          </div>
        ) : recent.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Bell className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No alerts recorded.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {recent.map(alert => (
              <li
                key={alert.id}
                className="flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm"
              >
                <span className="line-clamp-2 flex-1 text-sm">
                  {alert.message ?? 'No message'}
                </span>
                {alert.type && (
                  <Badge variant={getAlertVariant(alert.type)} className="shrink-0 capitalize">
                    {alert.type}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}