import { useCallback, useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { bbox as turfBbox } from '@turf/turf'
import axios, { type AxiosError } from 'axios'

function extractMsg(err: unknown): string {
  if (!axios.isAxiosError(err)) return String(err)
  const ae = err as AxiosError<{ detail?: unknown }>
  const detail = ae.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((d: { msg?: string; loc?: unknown[] }) =>
        [d.loc?.slice(-1)[0], d.msg].filter(Boolean).join(': '))
      .join(' · ')
  }
  return ae.message
}
import type { MapEngine, BoundaryGeometry, ImageCorners } from '@/engine/map.engine'
import { uploadFileFilesUploadPost } from '@networking/api/generated/files/files'
import { processZoningImageCitiesCityIdZoningProcessImagePost } from '@networking/api/generated/zoning/zoning'
import type { ZoningProcessResponse } from '@networking/api/model/zoningProcessResponse'

export type GeoPhase = 'idle' | 'uploading' | 'positioning' | 'processing' | 'done' | 'error'

export interface UseGeoreferenceResult {
  phase:       GeoPhase
  fileId:      string | null
  imageUrl:    string | null
  corners:     ImageCorners | null
  opacity:     number
  nColors:     number
  minAreaPx:   number
  result:      ZoningProcessResponse | null
  errorMsg:    string | null
  handleFile:  (file: File) => Promise<void>
  updateOpacity: (val: number) => void
  setNColors:  (val: number) => void
  setMinAreaPx:(val: number) => void
  submit:      () => Promise<void>
  reset:       () => void
}

const OVERLAY_ID     = 'ocr-georeference'
const CORNER_COLORS  = ['#22c55e', '#3b82f6', '#a855f7', '#f97316'] // TL TR BR BL
const CORNER_LABELS  = ['TL', 'TR', 'BR', 'BL']

function makeCornerEl(color: string, label: string): HTMLElement {
  const el = document.createElement('div')
  el.style.cssText = [
    `width:28px;height:28px;border-radius:50%`,
    `background:${color};border:2px solid white`,
    `display:flex;align-items:center;justify-content:center`,
    `font-size:9px;font-weight:700;color:white`,
    `cursor:grab;box-shadow:0 2px 8px rgba(0,0,0,.5)`,
    `user-select:none;line-height:1`,
  ].join(';')
  el.textContent = label
  return el
}

export function useGeoreference(
  engine: MapEngine | null,
  cityId: string | null,
  cityBoundary: BoundaryGeometry | null,
  onSuccess?: () => void,
): UseGeoreferenceResult {
  const [phase,      setPhase]      = useState<GeoPhase>('idle')
  const [fileId,     setFileId]     = useState<string | null>(null)
  const [imageUrl,   setImageUrl]   = useState<string | null>(null)
  const [imgDims,    setImgDims]    = useState<{ w: number; h: number } | null>(null)
  const [corners,    setCorners]    = useState<ImageCorners | null>(null)
  const [opacity,    setOpacity]    = useState(0.7)
  const [nColors,    setNColors]    = useState(8)
  const [minAreaPx,  setMinAreaPx]  = useState(500)
  const [result,     setResult]     = useState<ZoningProcessResponse | null>(null)
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null)

  // Stable refs for values used inside event handlers / effects
  const engineRef        = useRef(engine)
  const cornersRef       = useRef<ImageCorners | null>(null)
  const imgDimsRef       = useRef(imgDims)
  const cityBoundaryRef  = useRef(cityBoundary)
  const opacityRef       = useRef(opacity)
  const markersRef       = useRef<maplibregl.Marker[]>([])
  const blobUrlRef       = useRef<string | null>(null)  // keep alive for map overlay

  engineRef.current       = engine
  cornersRef.current      = corners
  imgDimsRef.current      = imgDims
  cityBoundaryRef.current = cityBoundary
  opacityRef.current      = opacity

  // Compute initial 4-corner placement based on city bbox + image aspect ratio.
  const computeInitialCorners = useCallback((): ImageCorners => {
    let cLng = 122.0, cLat = 12.0, halfW = 0.05
    const boundary = cityBoundaryRef.current
    const eng      = engineRef.current
    if (boundary) {
      try {
        const [minLng, minLat, maxLng, maxLat] = turfBbox({ type: 'Feature', geometry: boundary, properties: {} })
        cLng  = (minLng + maxLng) / 2
        cLat  = (minLat + maxLat) / 2
        halfW = (maxLng - minLng) * 0.3
      } catch { /* fallback */ }
    } else if (eng) {
      const c = eng.instance.getCenter()
      cLng = c.lng; cLat = c.lat
    }
    const dims      = imgDimsRef.current
    const aspect    = dims ? dims.h / dims.w : 1
    const halfH     = halfW * aspect
    return [
      [cLng - halfW, cLat + halfH],  // TL
      [cLng + halfW, cLat + halfH],  // TR
      [cLng + halfW, cLat - halfH],  // BR
      [cLng - halfW, cLat - halfH],  // BL
    ]
  }, [])

  const removeMarkers = useCallback(() => {
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
  }, [])

  const cleanupOverlay = useCallback(() => {
    removeMarkers()
    engineRef.current?.removeImageOverlay(OVERLAY_ID)
  }, [removeMarkers])

  // Full unmount cleanup
  useEffect(() => {
    return () => {
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
      engineRef.current?.removeImageOverlay(OVERLAY_ID)
      if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null }
    }
  }, [])

  // When entering 'positioning' phase → add overlay + draggable corner markers
  useEffect(() => {
    if (phase !== 'positioning' || !engine || !imageUrl) return

    const initCorners = computeInitialCorners()
    setCorners(initCorners)
    cornersRef.current = initCorners

    engine.addImageOverlay(OVERLAY_ID, imageUrl, initCorners)
    engine.setImageOverlayOpacity(OVERLAY_ID, opacityRef.current)

    const markers: maplibregl.Marker[] = initCorners.map((corner, i) => {
      const marker = new maplibregl.Marker({
        element: makeCornerEl(CORNER_COLORS[i], CORNER_LABELS[i]),
        draggable: true,
      })
        .setLngLat(corner as [number, number])
        .addTo(engine.instance)

      marker.on('drag', () => {
        const { lng, lat } = marker.getLngLat()
        const updated = [...(cornersRef.current ?? initCorners)] as ImageCorners
        updated[i] = [lng, lat]
        cornersRef.current = updated
        setCorners([...updated] as ImageCorners)
        engine.updateImageOverlay(OVERLAY_ID, updated)
      })

      return marker
    })

    markersRef.current = markers

    return () => {
      markers.forEach(m => m.remove())
      markersRef.current = []
      // Don't remove overlay on cleanup — let submit/reset handle it so it stays
      // visible while processing
    }
  }, [phase, engine, imageUrl, computeInitialCorners])

  async function handleFile(file: File) {
    setPhase('uploading')
    setErrorMsg(null)

    // Create blob URL — kept alive for the map overlay (do NOT revoke here)
    const objectUrl = URL.createObjectURL(file)
    blobUrlRef.current = objectUrl

    // Detect image dimensions from blob
    try {
      const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
        const img = new Image()
        img.onload  = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
        img.onerror = () => reject(new Error('Could not read image'))
        img.src = objectUrl
      })
      setImgDims(dims)
      imgDimsRef.current = dims
    } catch { /* proceed without dims, use default aspect ratio */ }

    try {
      const res = await uploadFileFilesUploadPost({ file })
      setFileId(res.data.file_id)  // now a clean Document UUID from backend
      // Use the local blob URL for the overlay — avoids CORS/absolute-URL issues with MapLibre
      setImageUrl(objectUrl)
      setPhase('positioning')
    } catch (err) {
      setErrorMsg(extractMsg(err))
      setPhase('error')
    }
  }

  function updateOpacity(val: number) {
    setOpacity(val)
    opacityRef.current = val
    engineRef.current?.setImageOverlayOpacity(OVERLAY_ID, val)
  }

  async function submit() {
    const c    = cornersRef.current
    const dims = imgDimsRef.current
    if (!fileId || !cityId || !c || !dims) return

    setPhase('processing')
    setErrorMsg(null)

    const gcps = [
      { pixel_x: 0,       pixel_y: 0,       longitude: c[0][0], latitude: c[0][1] },
      { pixel_x: dims.w,  pixel_y: 0,       longitude: c[1][0], latitude: c[1][1] },
      { pixel_x: dims.w,  pixel_y: dims.h,  longitude: c[2][0], latitude: c[2][1] },
      { pixel_x: 0,       pixel_y: dims.h,  longitude: c[3][0], latitude: c[3][1] },
    ]

    try {
      const res = await processZoningImageCitiesCityIdZoningProcessImagePost(cityId, {
        file_id:      fileId,
        gcps,
        n_colors:     nColors,
        min_area_px:  minAreaPx,
      })
      cleanupOverlay()
      setResult(res.data)
      setPhase('done')
      onSuccess?.()
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? ((err.response?.data as { detail?: string })?.detail ?? err.message)
        : String(err)
      setErrorMsg(extractMsg(err))
      setPhase('error')
    }
  }

  function reset() {
    cleanupOverlay()
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null }
    setPhase('idle')
    setFileId(null)
    setImageUrl(null)
    setImgDims(null)
    setCorners(null)
    setOpacity(0.7)
    setNColors(8)
    setMinAreaPx(500)
    setResult(null)
    setErrorMsg(null)
  }

  return {
    phase, fileId, imageUrl, corners, opacity, nColors, minAreaPx, result, errorMsg,
    handleFile, updateOpacity, setNColors, setMinAreaPx, submit, reset,
  }
}
