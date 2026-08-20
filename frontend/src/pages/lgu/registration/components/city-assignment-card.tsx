import { MapPin, Building2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { CityResponse } from '@networking/api/model/cityResponse'

interface CityAssignmentCardProps {
  city: CityResponse | null
  loading?: boolean
}

export function CityAssignmentCard({ city, loading }: CityAssignmentCardProps) {
  if (loading) {
    return (
      <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-32" />
      </div>
    )
  }

  if (!city) {
    return (
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2">
          <Building2 className="size-4 text-primary shrink-0" />
          <p className="text-xs font-medium text-primary">LGU Administrator Account</p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Your city assignment will be configured by the system administrator.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Building2 className="size-4 text-primary shrink-0" />
        <p className="text-xs font-medium text-primary">You are registering as LGU Admin for:</p>
      </div>

      <div className="flex items-start gap-2">
        <MapPin className="size-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-semibold leading-tight">{city.name}</p>
          {(city.province || city.region) && (
            <div className="flex flex-wrap gap-1">
              {city.province && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  {city.province}
                </Badge>
              )}
              {city.region && (
                <Badge variant="outline" className="text-xs px-1.5 py-0">
                  {city.region}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}