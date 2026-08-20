import { AlertTriangle, BrainCircuit, LayoutGrid, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useMapContext } from '@/context/map.context'
import { useCityContext } from '@/context/city.context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { HazardPanel } from './hazard-panel'
import { ZoningPanel } from './zoning-panel'
import { AnalyzePanel } from './analyze-panel'

type ActivePanel = 'hazard' | 'zoning' | 'analyze' | null

const STRIP_BUTTONS: { id: NonNullable<ActivePanel>; icon: LucideIcon; label: string }[] = [
  { id: 'hazard',  icon: AlertTriangle, label: 'Hazard Layers'       },
  { id: 'zoning',  icon: LayoutGrid,   label: 'Zoning Layers'        },
  { id: 'analyze', icon: BrainCircuit, label: 'Location Intelligence' },
]

const PANEL_TITLES: Record<NonNullable<ActivePanel>, string> = {
  hazard:  'Hazard Layers',
  zoning:  'Zoning Layers',
  analyze: 'Location Intelligence',
}

export function HazardControls() {
  const { hazardLayers, zoningPmtileUrl } = useMapContext()
  const { selectedCity } = useCityContext()
  const [activePanel, setActivePanel] = useState<ActivePanel>(null)

  const hasHazards = hazardLayers.length > 0
  const hasZoning  = !!zoningPmtileUrl || !!selectedCity?.id

  const disabled: Record<NonNullable<ActivePanel>, boolean> = {
    hazard:  !hasHazards,
    zoning:  !hasZoning,
    analyze: !selectedCity?.id,
  }

  return (
    <div className="absolute right-3 top-3 bottom-3 flex items-start gap-2 z-10 pointer-events-none">

      {activePanel && (
        <Card className="pointer-events-auto flex flex-col w-60 h-full shadow-2xl bg-background/95 backdrop-blur-md border-border/50 animate-in fade-in-0 slide-in-from-right-2 duration-150">
          <CardHeader className="pb-0 pt-3 px-3 shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                {activePanel ? PANEL_TITLES[activePanel] : ''}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 -mr-1 text-muted-foreground hover:text-foreground"
                onClick={() => setActivePanel(null)}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </CardHeader>

          <Separator className="mt-2 shrink-0" />

          <CardContent className="flex flex-col flex-1 min-h-0 p-0">
            {activePanel === 'hazard'  && <HazardPanel />}
            {activePanel === 'zoning'  && <ZoningPanel />}
            {activePanel === 'analyze' && <AnalyzePanel />}
          </CardContent>
        </Card>
      )}

      <TooltipProvider delayDuration={400}>
        <div className="pointer-events-auto self-center flex flex-col gap-0.5 rounded-xl bg-black/65 backdrop-blur-md shadow-2xl p-1.5 border border-white/10">
          {STRIP_BUTTONS.map((btn, i) => {
            const Icon = btn.icon
            const isActive   = activePanel === btn.id
            const isDisabled = disabled[btn.id]
            return (
              <div key={btn.id}>
                {i > 0 && <Separator className="my-0.5 bg-white/10" />}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={btn.label}
                      disabled={isDisabled}
                      onClick={() => setActivePanel(prev => prev === btn.id ? null : btn.id)}
                      className={cn(
                        'size-9 rounded-lg transition-all',
                        'hover:bg-white/15 text-white/60 hover:text-white',
                        'disabled:opacity-30 disabled:pointer-events-none',
                        isActive && 'bg-white/20 text-white ring-1 ring-white/30',
                      )}
                    >
                      <Icon className="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" sideOffset={8}>
                    {isDisabled
                      ? btn.id === 'analyze' ? `${btn.label} — select a city first` : `${btn.label} — no data`
                      : btn.label}
                  </TooltipContent>
                </Tooltip>
              </div>
            )
          })}
        </div>
      </TooltipProvider>
    </div>
  )
}
