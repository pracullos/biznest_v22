import type { ReactNode } from 'react'
import type { Polygon } from 'geojson'
import { CheckCircle2, FileJson, RotateCcw, Upload, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { extractPolygon, readFileAsText } from '@/composable/map.composable'

type UploadPhase = 'idle' | 'ready' | 'saving' | 'saved' | 'error'

export interface MapUploadPanelProps {
  phase:    UploadPhase
  fileName: string | null
  severity: number
  errorMsg: string | null
  onFileReady:   (fileName: string, geometry: Polygon) => void
  onFileClear:   () => void
  onSetSeverity: (value: number) => void
  onSave:        () => Promise<void>
  onReset:       () => void
  /** Type-specific selects rendered between the file zone and the severity slider. */
  children:  ReactNode
}

export function MapUploadPanel({
  phase, fileName, severity, errorMsg,
  onFileReady, onFileClear, onSetSeverity, onSave, onReset,
  children,
}: MapUploadPanelProps) {
  const locked = phase === 'saving'

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await readFileAsText(file)
    const geom = extractPolygon(text)
    if (!geom) { onFileClear(); return }
    onFileReady(file.name, geom)
  }

  return (
    <div className="flex flex-col gap-3 p-3 overflow-y-auto flex-1">

      {/* File drop zone */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">GeoJSON File</label>
        <label className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 cursor-pointer transition-colors text-center',
          locked ? 'pointer-events-none opacity-50' : 'hover:border-primary/50 hover:bg-muted/30',
          fileName ? 'border-green-500/50 bg-green-500/5' : 'border-border',
        )}>
          {fileName ? (
            <>
              <FileJson className="size-6 text-green-500" />
              <span className="text-[11px] font-medium text-green-600 break-all">{fileName}</span>
              <button type="button" onClick={e => { e.preventDefault(); onFileClear() }}
                className="text-[10px] text-muted-foreground hover:text-destructive">Remove</button>
            </>
          ) : (
            <>
              <Upload className="size-5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">Click to select a file</span>
              <span className="text-[10px] text-muted-foreground/60">GeoJSON · Polygon geometry</span>
            </>
          )}
          <input type="file" accept=".geojson,.json" className="hidden" disabled={locked}
            onChange={e => void handleFileChange(e)} />
        </label>
      </div>

      <Separator />

      {/* Type-specific selects (hazard type + scenario, or zone type) */}
      {children}

      {/* Severity */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Severity</label>
          <span className="text-xs font-semibold tabular-nums">{severity} / 5</span>
        </div>
        <input type="range" min={1} max={5} step={1} disabled={locked}
          value={severity} onChange={e => onSetSeverity(Number(e.target.value))}
          className="w-full accent-primary disabled:opacity-50" />
        <div className="flex justify-between text-[9px] text-muted-foreground"><span>Low</span><span>High</span></div>
      </div>

      <Separator />

      {phase === 'idle'   && <Button size="sm" disabled className="w-full text-xs h-8">Select a file first</Button>}
      {phase === 'ready'  && <Button size="sm" className="w-full text-xs h-8" onClick={() => void onSave()}>Save to Map</Button>}
      {phase === 'saving' && <Button size="sm" disabled className="w-full text-xs h-8">Saving…</Button>}
      {phase === 'saved' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
            <CheckCircle2 className="size-3.5" />Saved — layer updated on map
          </div>
          <Button size="sm" variant="outline" className="w-full text-xs h-8" onClick={onReset}>
            <RotateCcw className="size-3 mr-1.5" />Upload Another
          </Button>
        </div>
      )}
      {phase === 'error' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-1.5 text-xs text-destructive">
            <XCircle className="size-3.5 mt-0.5 shrink-0" /><span>{errorMsg}</span>
          </div>
          <Button size="sm" className="w-full text-xs h-8" onClick={() => void onSave()}>Retry Save</Button>
        </div>
      )}
    </div>
  )
}
