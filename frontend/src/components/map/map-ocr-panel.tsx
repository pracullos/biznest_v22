import { useRef, useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronUp, ImageIcon, Loader2, RotateCcw, Upload, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { UseGeoreferenceResult } from '@/pages/zoning/composables/use-georeference'

type Props = Pick<UseGeoreferenceResult,
  | 'phase' | 'result' | 'errorMsg' | 'opacity' | 'nColors' | 'minAreaPx'
  | 'handleFile' | 'updateOpacity' | 'setNColors' | 'setMinAreaPx' | 'submit' | 'reset'
>

const CORNER_COLORS = [
  { key: 'TL', color: '#22c55e', label: 'Top-Left' },
  { key: 'TR', color: '#3b82f6', label: 'Top-Right' },
  { key: 'BR', color: '#a855f7', label: 'Bottom-Right' },
  { key: 'BL', color: '#f97316', label: 'Bottom-Left' },
]

export function MapOcrPanel({
  phase, result, errorMsg, opacity, nColors, minAreaPx,
  handleFile, updateOpacity, setNColors, setMinAreaPx, submit, reset,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver]     = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
    e.target.value = ''
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) void handleFile(file)
  }

  return (
    <div className="flex flex-col gap-3 p-3 overflow-y-auto flex-1">

      {/* ── Idle: Upload area ── */}
      {phase === 'idle' && (
        <div className="flex flex-col gap-3">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Upload a scanned zoning map. Drag the corner handles on the map to align it, then run OCR to extract zone polygons.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={[
              'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-8 px-3',
              'text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors',
              'cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring',
              dragOver ? 'border-primary bg-primary/5 text-primary' : 'border-border',
            ].join(' ')}
          >
            <Upload className="size-8 opacity-50" />
            <span className="text-xs font-medium">Drop image here</span>
            <span className="text-[10px]">or click to browse</span>
            <span className="text-[10px] opacity-60">JPG · PNG · TIFF</span>
          </button>
        </div>
      )}

      {/* ── Uploading ── */}
      {phase === 'uploading' && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="size-7 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Uploading image…</p>
        </div>
      )}

      {/* ── Positioning: image on map, user aligns ── */}
      {phase === 'positioning' && (
        <>
          <div className="rounded-md bg-muted/50 px-3 py-2.5 text-[11px] flex items-start gap-2">
            <ImageIcon className="size-3.5 mt-0.5 shrink-0 text-primary" />
            <p className="text-muted-foreground leading-relaxed">
              Image overlaid on map. Drag the colored handles to align corners with real map features.
            </p>
          </div>

          {/* Corner legend */}
          <div className="grid grid-cols-2 gap-1">
            {CORNER_COLORS.map(({ key, color, label }) => (
              <div key={key} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <div className="size-3 rounded-full shrink-0 border border-white/20" style={{ background: color }} />
                <span>{label}</span>
              </div>
            ))}
          </div>

          <Separator />

          {/* Opacity */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Opacity</label>
              <span className="text-xs tabular-nums">{Math.round(opacity * 100)}%</span>
            </div>
            <input
              type="range" min={0.1} max={1} step={0.05}
              value={opacity}
              onChange={e => updateOpacity(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          {/* Advanced toggle */}
          <button
            onClick={() => setShowAdvanced(v => !v)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors w-fit"
          >
            {showAdvanced ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            Advanced settings
          </button>

          {showAdvanced && (
            <div className="flex flex-col gap-2 rounded-md bg-muted/40 p-2.5">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between">
                  <label className="text-[10px] text-muted-foreground">Color clusters</label>
                  <span className="text-[10px] tabular-nums">{nColors}</span>
                </div>
                <input type="range" min={3} max={16} step={1}
                  value={nColors} onChange={e => setNColors(Number(e.target.value))}
                  className="w-full accent-primary" />
                <p className="text-[9px] text-muted-foreground">Higher = more zone types detected</p>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between">
                  <label className="text-[10px] text-muted-foreground">Min area (px)</label>
                  <span className="text-[10px] tabular-nums">{minAreaPx}</span>
                </div>
                <input type="range" min={100} max={2000} step={50}
                  value={minAreaPx} onChange={e => setMinAreaPx(Number(e.target.value))}
                  className="w-full accent-primary" />
                <p className="text-[9px] text-muted-foreground">Smaller = more small zones kept</p>
              </div>
            </div>
          )}

          <Separator />

          <Button size="sm" className="w-full text-xs h-8 gap-1.5"
            onClick={() => void submit()}>
            <ImageIcon className="size-3.5" />
            Process with OCR
          </Button>

          <Button size="sm" variant="ghost" className="w-full text-xs h-7 text-muted-foreground"
            onClick={reset}>
            Cancel
          </Button>
        </>
      )}

      {/* ── Processing ── */}
      {phase === 'processing' && (
        <div className="flex flex-col items-center gap-4 py-8">
          <Loader2 className="size-8 animate-spin text-primary" />
          <div className="text-center space-y-1">
            <p className="text-xs font-medium">Analyzing zones…</p>
            <p className="text-[10px] text-muted-foreground">
              OCR + color segmentation running on the server. This may take 30–60 s.
            </p>
          </div>
        </div>
      )}

      {/* ── Done ── */}
      {phase === 'done' && result && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-xs font-medium">
            <CheckCircle2 className="size-4 shrink-0" />
            Zones extracted successfully
          </div>
          <div className="rounded-md bg-muted/50 px-3 py-2.5 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Zones created</span>
              <span className="font-semibold tabular-nums">{result.zones_created}</span>
            </div>
            {result.skipped_zones > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Zones skipped</span>
                <span className="tabular-nums text-amber-500">{result.skipped_zones}</span>
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Zones are now visible on the map. Adjust labels via the zoning panel.
          </p>
          <Button size="sm" variant="outline" className="w-full text-xs h-8 gap-1.5"
            onClick={reset}>
            <RotateCcw className="size-3" />
            Process Another Image
          </Button>
        </div>
      )}

      {/* ── Error ── */}
      {phase === 'error' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-1.5 text-xs text-destructive">
            <XCircle className="size-3.5 mt-0.5 shrink-0" />
            <span className="break-words">{errorMsg ?? 'An error occurred.'}</span>
          </div>
          <Button size="sm" className="w-full text-xs h-8 gap-1.5"
            onClick={reset}>
            <RotateCcw className="size-3" />
            Try Again
          </Button>
        </div>
      )}
    </div>
  )
}
