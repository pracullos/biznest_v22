import { AlertTriangle, Map, Building2, Bell } from 'lucide-react'
import { $api } from '@/lib/api-client'
import { useCityContext } from '@/context/city.context'
import { Spinner } from '@/components/ui/spinner'
import { StatCard } from '../../components/stat-card'

export function LguCityStatsWidget() {
  const { selectedCity } = useCityContext()
  const cityId = selectedCity?.id ?? ''

  const { data: stats, isLoading } = $api.useQuery('get', '/cities/{city_id}/stats', {
    params: { path: { city_id: cityId } },
  }, { enabled: !!cityId })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        Loading city statistics…
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard title="Hazard Areas" value={stats?.hazard_count ?? 0} icon={AlertTriangle} />
      <StatCard title="Zoning Areas" value={stats?.zoning_count ?? 0} icon={Map} />
      <StatCard title="Establishments" value={stats?.establishment_count ?? 0} icon={Building2} />
      <StatCard title="Alerts" value={stats?.alert_count ?? 0} icon={Bell} />
    </div>
  )
}
