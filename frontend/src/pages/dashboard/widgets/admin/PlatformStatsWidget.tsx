import { Users, Building2, ShieldCheck } from 'lucide-react'
import { useAllUsersUsersGet } from '@networking/api/generated/users/users'
import { listCitiesCitiesGet } from '@networking/api/generated/cities/cities'
import { useQuery } from '@tanstack/react-query'
import { Spinner } from '@/components/ui/spinner'
import { StatCard } from '../../components/stat-card'

export function PlatformStatsWidget() {
  const { data: usersData, isLoading: usersLoading } = useAllUsersUsersGet()
  const { data: citiesData, isLoading: citiesLoading } = useQuery({
    queryKey: ['/cities/'],
    queryFn: () => listCitiesCitiesGet().then(r => r.data),
  })

  const isLoading = usersLoading || citiesLoading

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        Loading platform data…
      </div>
    )
  }

  const users = usersData?.data ?? []
  const cities = citiesData ?? []

  const investorCount = users.filter(u => !u.is_superuser).length
  const superuserCount = users.filter(u => u.is_superuser).length
  const totalUsers = users.length

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard title="Total Cities" value={cities.length} icon={Building2} />
      <StatCard title="Total Users" value={totalUsers} icon={Users} />
      <StatCard title="Regular Users" value={investorCount} icon={Users} />
      <StatCard title="Admins" value={superuserCount} icon={ShieldCheck} />
    </div>
  )
}