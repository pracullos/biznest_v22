import type { ReactNode } from 'react'
import type { Polygon } from 'geojson'
import { CheckCircle2, Move, Pencil, RotateCcw, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { DrawMode } from '@/composable/map.composable'

type DrawPhase = 'configuring' | 'drawing' | 'drawn' | 'saving' | 'saved' | 'error'

export interface MapDrawPanelProps {
  phase:       DrawPhase
  drawMode:    DrawMode
  severity:    number
  pointCount:  number
  geometry:    Polygon | null
  errorMsg:    string | null
  onSetDrawMode:   (mode: DrawMode) => void
  onSetSeverity:   (value: number) => void
  onClearShape:    () => void
  onStartDrawing:  () => void
  onCancelDrawing: () => void
  onSave:          () => Promise<void>
  onDrawAnother:   () => void
  /** Type-specific fields rendered at the top (hazard type + scenario, or zone type). */
  children:    ReactNode
}

/** Reusable CSS class for type selects rendered in the children slot. */
export const mapSelectCls =
  'w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs ' +
  'focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 capitalize'

export function MapDrawPanel({
  phase, drawMode, severity, pointCount, geometry, errorMsg,
  onSetDrawMode, onSetSeverity, onClearShape,
  onStartDrawing, onCancelDrawing, onSave, onDrawAnother,
  children,
}: MapDrawPanelProps) {
  const locked = phase === 'drawing' || phase === 'saving'

  return (
    <div className="flex flex-col gap-3 p-3 overflow-y-auto flex-1">

      {/* Type-specific selects (hazard type + scenario, or zone type) */}
      {children}

      {/* Severity */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Severity</label>
          <span className="text-xs font-semibold tabular-nums">{severity} / 5</span>
        </div>
        <input type="range" min={1} max={5} step={1} disabled={phase === 'saving'}
          value={severity} onChange={e => onSetSeverity(Number(e.target.value))}
          className="w-full accent-primary disabled:opacity-50" />
        <div className="flex justify-between text-[9px] text-muted-foreground"><span>Low</span><span>High</span></div>
      </div>

      <Separator />

      {/* Draw mode */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Draw Mode</span>
        <div className="flex gap-1">
          {(['draw_polygon', 'draw_freehand'] as DrawMode[]).map(m => (
            <button key={m} disabled={locked} onClick={() => onSetDrawMode(m)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs border transition-all',
                'disabled:pointer-events-none disabled:opacity-40',
                drawMode === m
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground',
              )}>
              {m === 'draw_polygon' ? <Pencil className="size-3" /> : <Move className="size-3" />}
              {m === 'draw_polygon' ? 'Polygon' : 'Freehand'}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          {drawMode === 'draw_polygon'
            ? 'Click to place points · double-click to finish'
            : 'Hold and drag on the map'}
        </p>
      </div>

      <Separator />

      {phase === 'drawing' && (
        <Button size="sm" variant="outline" className="w-full text-xs h-8" onClick={onCancelDrawing}>
          Cancel Drawing
        </Button>
      )}

      {/* Start / Redraw — both modes */}
      {(phase === 'configuring' || phase === 'drawn') && (
        <Button size="sm" className="w-full text-xs h-8" onClick={onStartDrawing}>
          {phase === 'drawn' ? 'Redraw' : 'Start Drawing'}
        </Button>
      )}

      {/* Shape ready — both modes */}
      {(phase === 'drawn' || phase === 'error') && geometry && (
        <div className="rounded-md bg-muted/60 px-3 py-2 text-[11px] flex items-center gap-2">
          <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />
          <span>Shape ready · <span className="font-medium tabular-nums">{pointCount} pts</span></span>
          <button onClick={onClearShape}
            className="ml-auto text-[10px] text-muted-foreground hover:text-foreground">Clear</button>
        </div>
      )}

      {/* Save — both modes */}
      {phase === 'drawn' && (
        <Button size="sm" className="w-full text-xs h-8" onClick={() => void onSave()}>Save to Map</Button>
      )}

      {/* Error — both modes */}
      {phase === 'error' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-1.5 text-xs text-destructive">
            <XCircle className="size-3.5 mt-0.5 shrink-0" /><span>{errorMsg}</span>
          </div>
          <Button size="sm" className="w-full text-xs h-8" onClick={() => void onSave()}>Retry Save</Button>
        </div>
      )}

      {/* Shared: saving + saved (both modes) */}
      {phase === 'saving' && (
        <Button size="sm" disabled className="w-full text-xs h-8">Saving…</Button>
      )}
      {phase === 'saved' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
            <CheckCircle2 className="size-3.5" />Saved — layer updated on map
          </div>
          <Button size="sm" variant="outline" className="w-full text-xs h-8" onClick={onDrawAnother}>
            <RotateCcw className="size-3 mr-1.5" />Draw Another
          </Button>
        </div>
      )}
    </div>
  )
}
