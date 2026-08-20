import { ShieldAlert } from 'lucide-react'
import { useListHazardPmtilesCitiesCityIdHazardsPmtilesGet } from '@networking/api/generated/hazards/hazards'
import { useCityContext } from '@/context/city.context'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

const HAZARD_COLOR: Record<string, string> = {
  flood: 'bg-blue-100 text-blue-800 border-blue-200',
  landslide: 'bg-orange-100 text-orange-800 border-orange-200',
  storm_surge: 'bg-purple-100 text-purple-800 border-purple-200',
  debris_flow: 'bg-amber-100 text-amber-800 border-amber-200',
  faultline: 'bg-red-100 text-red-800 border-red-200',
}

function hazardColorClass(type: string): string {
  return HAZARD_COLOR[type.toLowerCase()] ?? 'bg-gray-100 text-gray-800 border-gray-200'
}

export function InvestorHazardWidget() {
  const { selectedCity } = useCityContext()
  const cityId = selectedCity?.id ?? ''

  const { data, isLoading } = useListHazardPmtilesCitiesCityIdHazardsPmtilesGet(cityId)

  const pmtiles = data?.data ?? []

  const grouped = pmtiles.reduce<Record<string, number>>((acc, tile) => {
    const key = tile.hazard_type
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const entries = Object.entries(grouped)

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Hazard Coverage</CardTitle>
        <CardDescription>Scenarios available for {selectedCity?.name ?? 'this city'}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            Loading hazard data…
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <ShieldAlert className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No hazard data available.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {entries.map(([type, count]) => (
              <li key={type} className="flex items-center justify-between gap-2">
                <span className="text-sm capitalize">{type.replace(/_/g, ' ')}</span>
                <span
                  className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${hazardColorClass(type)}`}
                >
                  {count} {count === 1 ? 'scenario' : 'scenarios'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}