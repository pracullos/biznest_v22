import { Link } from '@tanstack/react-router'
import { MapPin, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthContext } from '@/context/auth.context'
import { useCityContext } from '@/context/city.context'
import { getWidgetsForRole } from '@/config/widgets.config'

const COL_SPAN_CLASS: Record<number, string> = {
  1: 'col-span-1',
  2: 'col-span-1 md:col-span-2',
  3: 'col-span-1 md:col-span-2 lg:col-span-3',
}

export function DashboardPage() {
  const { state } = useAuthContext()
  const { selectedCity, cityId } = useCityContext()

  const auth = state.state === 'AUTHENTICATED' ? state : null
  const user = auth?.user ?? null
  const role_name = auth?.role_name ?? null
  const isInvestor = role_name === 'investor'

  const widgets = getWidgetsForRole(role_name, cityId)

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome back, {user?.full_name ?? user?.email}
        </p>
      </div>

      {/* No city selected (investors only) */}
      {isInvestor && !selectedCity && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <MapPin className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No city selected.</p>
          <Button variant="outline" size="sm" asChild>
            <Link to="/cities">
              Select a City
              <ArrowRight className="ml-1.5 size-3.5" />
            </Link>
          </Button>
        </div>
      )}

      {/* Widget grid */}
      {widgets.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {widgets.map(widget => {
            const span = widget.colSpan ?? 1
            const Widget = widget.component
            return (
              <div key={widget.id} className={COL_SPAN_CLASS[span]}>
                <Widget />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}