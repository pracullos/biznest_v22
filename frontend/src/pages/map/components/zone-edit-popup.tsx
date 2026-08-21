import { useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, X, PenLine, Trash2, AlertTriangle } from 'lucide-react'
import { useMapContext } from '@/context/map.context'
import { useCityContext } from '@/context/city.context'
import { $api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { ZONE_TYPE_COLORS, ZONE_TYPE_LABELS } from '@/config/hazard.config'
import type { ZoneType } from '@/types/api-aliases'

const PRESET_ZONE_TYPES = Object.keys(ZONE_TYPE_LABELS)
const selectCls =
  'w-full rounded-md border border-input bg-background px-2 py-1 text-xs h-7 ' +
  'focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50'

type View = 'edit' | 'confirm-delete'

export function ZoneEditPopup() {
  const { engine, clickedZone, setClickedZone, refreshZoningLayer } = useMapContext()
  const { selectedCity } = useCityContext()
  const queryClient = useQueryClient()

  const [label,    setLabel]    = useState('')
  const [isCustom, setIsCustom] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>('edit')
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset state when a new zone is selected
  useEffect(() => {
    if (!clickedZone) { setError(null); return }
    const type = clickedZone.zoneType
    const custom = !!type && !PRESET_ZONE_TYPES.includes(type)
    setLabel(type)
    setIsCustom(custom)
    setError(null)
    setView('edit')
    setTimeout(() => inputRef.current?.select(), 50)
  }, [clickedZone?.id])

  // Project lngLat → screen pixel, re-sync on map move/zoom
  useEffect(() => {
    if (!engine || !clickedZone) { setPos(null); return }
    const update = () => {
      const p = engine.instance.project([clickedZone.lngLat.lng, clickedZone.lngLat.lat])
      setPos({ x: p.x, y: p.y })
    }
    update()
    engine.instance.on('move', update)
    engine.instance.on('zoom', update)
    engine.instance.on('resize', update)
    return () => {
      engine.instance.off('move', update)
      engine.instance.off('zoom', update)
      engine.instance.off('resize', update)
    }
  }, [engine, clickedZone])

  const patchZone   = $api.useMutation('patch', '/cities/{city_id}/zoning/{zone_id}')
  const deleteZone  = $api.useMutation('delete', '/cities/{city_id}/zoning/{zone_id}')
  const regenerate  = $api.useMutation('post', '/cities/{city_id}/zoning/regenerate-pmtiles')
  const patching    = patchZone.isPending
  const deleting    = deleteZone.isPending
  const regenerating = regenerate.isPending
  const isBusy = patching || deleting || regenerating

  if (!clickedZone || !pos) return null

  function extractError(err: unknown): string {
    const detail = err && typeof err === 'object' && 'detail' in err ? (err as { detail?: unknown }).detail : undefined
    return typeof detail === 'string' ? detail : 'Operation failed'
  }

  async function handleSave() {
    if (!selectedCity || !clickedZone) return
    const trimmed = label.trim()
    if (!trimmed) return
    setError(null)
    try {
      await patchZone.mutateAsync({
        params: { path: { city_id: selectedCity.id, zone_id: clickedZone.id } },
        body: { zone_type: trimmed as ZoneType },
      })
      const res = await regenerate.mutateAsync({ params: { path: { city_id: selectedCity.id } } })
      await refreshZoningLayer(res.pmtile_url)
      invalidate(selectedCity.id)
      setClickedZone(null)
    } catch (err) {
      setError(extractError(err))
    }
  }

  async function handleDelete() {
    if (!selectedCity || !clickedZone) return
    setError(null)
    try {
      await deleteZone.mutateAsync({ params: { path: { city_id: selectedCity.id, zone_id: clickedZone.id } } })
      // Regenerate PMTile — if no zones remain the endpoint will 404 → clear layer
      try {
        const res = await regenerate.mutateAsync({ params: { path: { city_id: selectedCity.id } } })
        await refreshZoningLayer(res.pmtile_url)
      } catch {
        await refreshZoningLayer(null)
      }
      invalidate(selectedCity.id)
      setClickedZone(null)
    } catch (err) {
      setError(extractError(err))
      setView('edit')
    }
  }

  function invalidate(cityId: string) {
    queryClient.invalidateQueries({ queryKey: $api.queryOptions('get', '/cities/{city_id}/zoning', { params: { path: { city_id: cityId } } }).queryKey })
    queryClient.invalidateQueries({ queryKey: $api.queryOptions('get', '/cities/{city_id}/zoning/pmtiles', { params: { path: { city_id: cityId } } }).queryKey })
  }

  return (
    <div
      className="absolute z-20 pointer-events-auto"
      style={{ left: pos.x, top: pos.y, transform: 'translate(-50%, calc(-100% - 14px))' }}
    >
      <div className="bg-popover border border-border rounded-lg shadow-xl p-3 w-56 space-y-2.5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold flex items-center gap-1.5">
            {view === 'confirm-delete'
              ? <><AlertTriangle className="size-3.5 text-destructive" /> Delete zone?</>
              : <><PenLine className="size-3.5 text-muted-foreground" /> Edit zone type</>}
          </span>
          <button
            className="text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setClickedZone(null)}
            aria-label="Close"
            disabled={isBusy}
          >
            <X className="size-3.5" />
          </button>
        </div>

        {view === 'edit' ? (
          <>
            {/* Zone type selector */}
            <div className="flex items-center gap-1.5">
              <div
                className="size-3 rounded-sm shrink-0 border border-border"
                style={{ background: (!isCustom && ZONE_TYPE_COLORS[label]) ? ZONE_TYPE_COLORS[label] : '#888888' }}
              />
              <select
                className={selectCls}
                disabled={isBusy}
                value={isCustom ? '__other__' : (label ?? '')}
                onChange={e => {
                  if (e.target.value === '__other__') {
                    setIsCustom(true)
                    setLabel('')
                    setTimeout(() => inputRef.current?.focus(), 30)
                  } else {
                    setIsCustom(false)
                    setLabel(e.target.value)
                  }
                }}
              >
                {PRESET_ZONE_TYPES.map(t => (
                  <option key={t} value={t}>{ZONE_TYPE_LABELS[t]}</option>
                ))}
                <option value="__other__">Other…</option>
              </select>
            </div>

            {/* Custom label input shown when "Other" selected */}
            {isCustom && (
              <Input
                ref={inputRef}
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="Enter custom zone type"
                className="h-7 text-xs"
                disabled={isBusy}
                onKeyDown={e => {
                  if (e.key === 'Enter') void handleSave()
                  if (e.key === 'Escape') setClickedZone(null)
                }}
              />
            )}

            {/* Status */}
            {regenerating && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" /> Rebuilding PMTile…
              </p>
            )}
            {error && <p className="text-[10px] text-destructive">{error}</p>}

            {/* Save / Cancel */}
            <div className="flex gap-1.5">
              <Button
                size="sm"
                className="flex-1 h-7 text-xs gap-1"
                onClick={handleSave}
                disabled={isBusy || !label.trim()}
              >
                {patching || regenerating
                  ? <Loader2 className="size-3 animate-spin" />
                  : <><Check className="size-3" /> Save</>}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setClickedZone(null)}
                disabled={isBusy}
              >
                Cancel
              </Button>
            </div>

            <Separator />

            {/* Delete trigger */}
            <Button
              size="sm"
              variant="ghost"
              className="w-full h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
              onClick={() => setView('confirm-delete')}
              disabled={isBusy}
            >
              <Trash2 className="size-3" /> Delete zone
            </Button>
          </>
        ) : (
          <>
            {/* Confirm delete */}
            <p className="text-[11px] text-muted-foreground">
              This zone will be permanently removed and the PMTile rebuilt.
            </p>

            {regenerating && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" /> Rebuilding PMTile…
              </p>
            )}
            {error && <p className="text-[10px] text-destructive">{error}</p>}

            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="destructive"
                className="flex-1 h-7 text-xs gap-1"
                onClick={handleDelete}
                disabled={isBusy}
              >
                {deleting || regenerating
                  ? <Loader2 className="size-3 animate-spin" />
                  : <><Trash2 className="size-3" /> Confirm</>}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => { setView('edit'); setError(null) }}
                disabled={isBusy}
              >
                Back
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Down-pointing arrow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-x-[5px] border-x-transparent border-t-[5px] border-t-border" />
      <div className="absolute bottom-px left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-x-[4px] border-x-transparent border-t-[4px] border-t-popover" />
    </div>
  )
}