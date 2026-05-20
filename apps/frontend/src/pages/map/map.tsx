import { useEffect, useRef } from 'react'
import { Map } from '@/components/map'
import { HazardControls } from './components/hazard-controls'
import { ZoneEditPopup } from './components/zone-edit-popup'
import { useMapContext } from '@/context/map.context'
import { useCityContext } from '@/context/city.context'
import { usePermission } from '@/hooks/use-permission'
import { PERMISSION } from '@/config/permissions'
import type { BoundaryGeometry } from '@/engine/map.engine'

export function MapPage() {
  const { engine, refreshHazardLayers } = useMapContext()
  const { cityBoundary }               = useCityContext()
  const canEditZones                   = usePermission(PERMISSION.ZONING_WRITE)

  const prevBoundaryRef = useRef<BoundaryGeometry | null>(null)

  // flyTo when city boundary first loads or changes
  useEffect(() => {
    if (!engine || !cityBoundary) return
    if (prevBoundaryRef.current === cityBoundary) return
    prevBoundaryRef.current = cityBoundary
    engine.flyToCityBoundary(cityBoundary)
  }, [engine, cityBoundary])

  // Re-fetch hazard tiles every time the map page mounts so data saved on /hazard appears
  useEffect(() => {
    if (!engine) return
    void refreshHazardLayers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine])

  return (
    <Map className="size-full">
      <HazardControls />
      {canEditZones && <ZoneEditPopup />}
    </Map>
  )
}
