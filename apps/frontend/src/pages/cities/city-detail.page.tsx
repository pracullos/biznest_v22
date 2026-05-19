import { useParams, useNavigate } from '@tanstack/react-router'
import {
  AlertTriangle, ArrowLeft, Building2, LayoutGrid,
  MapPin, ShieldAlert, UserCheck, UserX, Bell,
} from 'lucide-react'
import { useGetCityCitiesCityIdGet, useGetCityStatsCitiesCityIdStatsGet } from '@networking/api/generated/cities/cities'
import { useListHazardPmtilesCitiesCityIdHazardsPmtilesGet } from '@networking/api/generated/hazards/hazards'
import { useListZoningAreasCitiesCityIdZoningGet } from '@networking/api/generated/zoning/zoning'
import { useListEstablishmentsCitiesCityIdEstablishmentsGet } from '@networking/api/generated/establishments/establishments'
import { useListAssignmentsLguAssignmentsGet } from '@networking/api/generated/lgu-assignments/lgu-assignments'
import { useAllUsersUsersGet } from '@networking/api/generated/users/users'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { HAZARD_TYPE_LABELS, ZONE_TYPE_LABELS } from '@/config/hazard.config'

const HAZARD_COLORS: Record<string, string> = {
  flood:       'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  landslide:   'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  storm_surge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  debris_flow: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  faultline:   'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
}

export function CityDetailPage() {
  const { cityId } = useParams({ from: '/_protected/cities/$cityId' })
  const navigate = useNavigate()

  const { data: cityRes,    isLoading: cityLoading }    = useGetCityCitiesCityIdGet(cityId)
  const { data: statsRes,   isLoading: statsLoading }   = useGetCityStatsCitiesCityIdStatsGet(cityId)
  const { data: hazardRes,  isLoading: hazardLoading }  = useListHazardPmtilesCitiesCityIdHazardsPmtilesGet(cityId)
  const { data: zoningRes,  isLoading: zoningLoading }  = useListZoningAreasCitiesCityIdZoningGet(cityId)
  const { data: estabRes,   isLoading: estabLoading }   = useListEstablishmentsCitiesCityIdEstablishmentsGet(cityId)
  const { data: assignRes }                              = useListAssignmentsLguAssignmentsGet()
  const { data: usersRes }                               = useAllUsersUsersGet()

  const city          = cityRes?.data
  const stats         = statsRes?.data
  const hazardTiles   = hazardRes?.data ?? []
  const zones         = zoningRes?.data ?? []
  const establishments = estabRes?.data ?? []

  const assignment = assignRes?.data?.find(a => a.city_id === cityId)
  const lguAdmin   = assignment ? usersRes?.data?.find(u => u.id === assignment.user_id) : null

  // Hazard breakdown: unique types → scenario count
  const hazardByType = hazardTiles.reduce<Record<string, number>>((acc, t) => {
    acc[t.hazard_type] = (acc[t.hazard_type] ?? 0) + 1
    return acc
  }, {})

  // Zoning breakdown
  const zoningByType = zones.reduce<Record<string, number>>((acc, z) => {
    const key = z.zone_type ?? '(unlabelled)'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const isPageLoading = cityLoading || statsLoading

  return (
    <div className="space-y-6 pb-8">

      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" className="mt-0.5 shrink-0"
          onClick={() => void navigate({ to: '/cities' as never })}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          {cityLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold truncate">{city?.name ?? '—'}</h1>
                {assignment ? (
                  <Badge variant="outline" className="text-green-600 border-green-500/40 bg-green-500/10 text-[11px]">
                    LGU Admin Assigned
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground text-[11px]">
                    No Admin
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                <MapPin className="size-3.5 shrink-0" />
                <span>{[city?.province, city?.region].filter(Boolean).join(' · ') || 'No location info'}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Hazard Areas',    value: stats?.hazard_count,       icon: ShieldAlert,  color: 'text-red-500' },
          { label: 'Zoning Areas',    value: stats?.zoning_count,       icon: LayoutGrid,   color: 'text-blue-500' },
          { label: 'Establishments',  value: stats?.establishment_count, icon: Building2,    color: 'text-emerald-500' },
          { label: 'Alerts',          value: stats?.alert_count,         icon: Bell,         color: 'text-amber-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{label}</p>
                <Icon className={`size-4 ${color}`} />
              </div>
              {statsLoading ? (
                <Skeleton className="h-7 w-12 mt-1" />
              ) : (
                <p className="text-2xl font-bold mt-1 tabular-nums">{value ?? 0}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Hazard breakdown */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="size-4 text-red-500" />
              Hazard Coverage
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="p-4">
            {hazardLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : Object.keys(hazardByType).length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No hazard data yet</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(hazardByType).map(([type, count]) => (
                  <div key={type}
                    className={`flex items-center justify-between px-3 py-2 rounded-md border text-xs ${HAZARD_COLORS[type] ?? 'bg-muted/40 border-border'}`}>
                    <span className="font-medium">{HAZARD_TYPE_LABELS[type] ?? type}</span>
                    <span className="tabular-nums font-semibold">{count} scenario{count !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* LGU Admin */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <UserCheck className="size-4 text-indigo-500" />
              LGU Administrator
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="p-4">
            {!assignment ? (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <UserX className="size-8 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">No LGU admin assigned to this city yet.</p>
              </div>
            ) : lguAdmin ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                      {lguAdmin.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{lguAdmin.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{lguAdmin.email}</p>
                  </div>
                </div>
                <Separator />
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Status</span>
                    <Badge variant="outline"
                      className={lguAdmin.is_active ? 'text-green-600 border-green-500/40 bg-green-500/10' : 'text-red-600 border-red-500/40 bg-red-500/10'}>
                      {lguAdmin.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Assigned</span>
                    <span className="text-foreground">
                      {new Date(assignment.created_at).toLocaleDateString('en-PH', { dateStyle: 'medium' })}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Zoning summary */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <LayoutGrid className="size-4 text-blue-500" />
              Zoning Summary
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="p-4">
            {zoningLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-7 w-full" />)}
              </div>
            ) : Object.keys(zoningByType).length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No zoning data yet</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(zoningByType)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => (
                    <div key={type} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium capitalize">
                            {ZONE_TYPE_LABELS[type] ?? type}
                          </span>
                          <span className="tabular-nums text-muted-foreground">{count}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{ width: `${Math.round((count / zones.length) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                <p className="text-[10px] text-muted-foreground pt-1">{zones.length} total zones</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Establishments */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="size-4 text-emerald-500" />
            Establishments
            {!estabLoading && (
              <span className="text-xs font-normal text-muted-foreground ml-1">
                ({establishments.length})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          {estabLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : establishments.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Building2 className="size-8 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">No establishments recorded for this city.</p>
            </div>
          ) : (
            <div className="divide-y">
              {establishments.slice(0, 20).map(e => (
                <div key={e.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="size-7 rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Building2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{e.name ?? 'Unnamed'}</p>
                    {e.category && (
                      <p className="text-xs text-muted-foreground truncate capitalize">{e.category}</p>
                    )}
                  </div>
                  {e.latitude && e.longitude && (
                    <p className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                      {parseFloat(e.latitude).toFixed(4)}, {parseFloat(e.longitude).toFixed(4)}
                    </p>
                  )}
                </div>
              ))}
              {establishments.length > 20 && (
                <p className="text-center text-xs text-muted-foreground py-3">
                  Showing 20 of {establishments.length} establishments
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
