import { LayoutGrid, Plus, Loader2 } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useMapContext } from '@/context/map.context'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useZoningPanel } from '@/composable/map.composable'
import { usePermission } from '@/hooks/use-permission'
import { PERMISSION } from '@/config/permissions'

const HEX_RE = /^#[0-9a-fA-F]{3,8}$/

function zoneTypeLabel(type: string): string {
  if (type === '(unlabelled)') return '(unlabelled)'
  if (HEX_RE.test(type)) return 'Unlabelled (OCR)'
  return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')
}

export function ZoningPanel() {
  const { visibleZoningTypes, toggleZoningType, toggleZoningTypeGroup, showZoning } = useMapContext()
  const { pmtileUrl, zones, zoneTypes, zoneColors, isLoading } = useZoningPanel()
  const canWrite = usePermission(PERMISSION.ZONING_WRITE)
  const navigate = useNavigate()

  if (isLoading) return (
    <div className="flex flex-1 items-center justify-center gap-2 text-xs text-muted-foreground">
      <Loader2 className="size-3.5 animate-spin" /> Loading zones…
    </div>
  )

  if (!pmtileUrl && zones.length === 0) return (
    <div className="flex flex-1 items-center justify-center px-4 text-center">
      <div className="space-y-2.5">
        <LayoutGrid className="mx-auto size-8 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          No zoning data for this city yet.
        </p>
        {canWrite && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5"
            onClick={() => void navigate({ to: '/zoning' as never })}
          >
            <Plus className="size-3.5" /> Add Zoning Data
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-3 pt-2 pb-1 shrink-0 flex items-center gap-2">
        {pmtileUrl && (
          <>
            <div className="size-2 rounded-full bg-green-500 shrink-0" />
            <span className="text-[11px] text-muted-foreground flex-1">Tile layer loaded</span>
          </>
        )}
        {canWrite && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5 ml-auto"
            onClick={() => void navigate({ to: '/zoning' as never })}
          >
            <Plus className="size-3.5" /> Add
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="px-3 py-2 space-y-0">
          <p className="text-[10px] font-medium text-muted-foreground py-1.5 mb-1">
            {zones.length} zone{zones.length !== 1 ? 's' : ''} · {zoneTypes.length} type{zoneTypes.length !== 1 ? 's' : ''}
          </p>

          {(() => {
            // Split into named types and OCR hex-color types
            const namedTypes = zoneTypes.filter(([t]) => !HEX_RE.test(t))
            const ocrTypes   = zoneTypes.filter(([t]) => HEX_RE.test(t))
            const ocrKeys    = ocrTypes.map(([t]) => t)
            const ocrCount   = ocrTypes.reduce((s, [, n]) => s + n, 0)
            const allFilterKeys = zoneTypes.map(([t]) => t === '(unlabelled)' ? '' : t)

            const rows: Array<{ key: string; label: string; count: number; color: string | null; isGroup?: true; groupKeys?: string[] }> = [
              ...namedTypes.map(([type, count]) => ({
                key:   type === '(unlabelled)' ? '' : type,
                label: zoneTypeLabel(type),
                count,
                color: zoneColors[type] ?? null,
              })),
              ...(ocrCount > 0 ? [{
                key:       '__ocr__',
                label:     'Unlabelled (OCR)',
                count:     ocrCount,
                color:     ocrKeys[0] ?? null,   // representative color swatch
                isGroup:   true as const,
                groupKeys: ocrKeys,
              }] : []),
            ]

            return rows.map((row, i) => {
              const isVisible = showZoning && (
                row.isGroup
                  ? (visibleZoningTypes === null || row.groupKeys!.some(k => visibleZoningTypes.has(k)))
                  : (visibleZoningTypes === null || visibleZoningTypes.has(row.key))
              )
              return (
                <div key={row.key}>
                  {i > 0 && <Separator className="my-0 opacity-30" />}
                  <div className="flex items-center gap-2 py-1.5">
                    {row.color && (
                      <div
                        className="size-2.5 rounded-sm shrink-0 border border-white/10"
                        style={{ background: row.color }}
                      />
                    )}
                    <span className={cn('text-xs truncate flex-1', !isVisible && 'opacity-40 line-through')}>
                      {row.label}
                    </span>
                    <span className="text-[10px] tabular-nums text-muted-foreground shrink-0 mr-1">{row.count}</span>
                    <Switch
                      checked={isVisible}
                      onCheckedChange={() =>
                        row.isGroup
                          ? toggleZoningTypeGroup(row.groupKeys!, allFilterKeys)
                          : toggleZoningType(row.key, allFilterKeys)
                      }
                      className="shrink-0 scale-75"
                    />
                  </div>
                </div>
              )
            })
          })()}
        </div>
      </ScrollArea>
    </div>
  )
}