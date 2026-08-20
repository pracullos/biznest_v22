import { createContext, useContext } from 'react'
import type { CityResponse } from '@networking/api/model/cityResponse'
import type { BoundaryGeometry } from '@/engine/map.engine'
import type { BoundaryPhase } from '@/reducer/boundary.reducer'

export interface CityData {
  selectedCity:  CityResponse | null
  cityId:        string | null
  cityBoundary:  BoundaryGeometry | null
  boundaryPhase: BoundaryPhase
  boundaryError: string | null
  selectCity:    (city: CityResponse) => Promise<void>
  clearCity:     () => void
}

export const CityContext = createContext<CityData>({
  selectedCity:  null,
  cityId:        null,
  cityBoundary:  null,
  boundaryPhase: 'idle',
  boundaryError: null,
  selectCity:    async () => {},
  clearCity:     () => {},
})

export const useCityContext = () => useContext(CityContext)
