import { Users, Building2, ShieldCheck } from 'lucide-react'
import { $api } from '@/lib/api-client'
import { Spinner } from '@/components/ui/spinner'
import { StatCard } from '../../components/stat-card'

export function PlatformStatsWidget() {
  const { data: usersData, isLoading: usersLoading } = $api.useQuery('get', '/users/')
  const { data: cities, isLoading: citiesLoading } = $api.useQuery('get', '/cities/')

  const isLoading = usersLoading || citiesLoading

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        Loading platform data…
      </div>
    )
  }

  const users = usersData ?? []

  const investorCount = users.filter(u => !u.is_superuser).length
  const superuserCount = users.filter(u => u.is_superuser).length
  const totalUsers = users.length

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard title="Total Cities" value={cities?.length ?? 0} icon={Building2} />
      <StatCard title="Total Users" value={totalUsers} icon={Users} />
      <StatCard title="Regular Users" value={investorCount} icon={Users} />
      <StatCard title="Admins" value={superuserCount} icon={ShieldCheck} />
    </div>
  )
}
