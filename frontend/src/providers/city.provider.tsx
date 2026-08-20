import { useEffect, useReducer, type PropsWithChildren } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { getCityCitiesCityIdGet } from '@networking/api/generated/cities/cities'
import { useAuthContext } from '@/context/auth.context'
import { CityContext, type CityData } from '@/context/city.context'
import type { CityResponse } from '@networking/api/model/cityResponse'
import type { BoundaryGeometry } from '@/engine/map.engine'
import { boundaryReducer, BOUNDARY_INITIAL } from '@/reducer/boundary.reducer'

interface CityGeometryResponse {
  id: string
  boundary: BoundaryGeometry | null
}

export function CityProvider({ children }: PropsWithChildren) {
  const { state, selectCity: authSelectCity } = useAuthContext()

  function selectCity(city: CityResponse) {
    return authSelectCity(city.id)
  }

  const cityId = state.state === 'AUTHENTICATED' ? (state.city_id ?? null) : null

  const [boundaryState, dispatchBoundary] = useReducer(boundaryReducer, BOUNDARY_INITIAL)

  const { data: selectedCity = null } = useQuery({
    queryKey: ['/cities/', cityId],
    queryFn:  () => getCityCitiesCityIdGet(cityId!).then(r => r.data),
    enabled:  !!cityId,
    staleTime: 5 * 60 * 1000,
  })

  const {
    data: cityBoundary = null,
    isLoading: isBoundaryFetching,
    isError:   isBoundaryError,
    isSuccess: isBoundarySuccess,
    error:     boundaryQueryError,
  } = useQuery({
    queryKey: ['/cities/', cityId, 'geometry'],
    queryFn:  () =>
      axios.get<CityGeometryResponse>(`/cities/${cityId}/geometry`).then(r => r.data.boundary),
    enabled:  !!cityId,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  })

  // Single effect owns all reducer transitions.
  //
  // Two-effect design (RESET on cityId + sync on query state) has a race:
  // RESET fires → phase='idle', then sync fires but TanStack Query may be in
  // status='pending' + fetchStatus='idle' briefly (not yet fetching, not yet
  // success), so nothing dispatches → spinner stuck at 'idle' indefinitely.
  //
  // One effect avoids the race: cityId change, fetching, error, and success
  // are all evaluated in a single pass; the fallback FETCH_START covers the
  // transient pending-not-yet-fetching window.
  useEffect(() => {
    if (!cityId) {
      dispatchBoundary({ type: 'RESET' })
      return
    }
    if (isBoundaryFetching) {
      dispatchBoundary({ type: 'FETCH_START' })
      return
    }
    if (isBoundaryError) {
      const msg = boundaryQueryError instanceof Error
        ? boundaryQueryError.message
        : 'Failed to load city boundary'
      dispatchBoundary({ type: 'FETCH_ERROR', error: msg })
      return
    }
    if (isBoundarySuccess) {
      dispatchBoundary({ type: 'FETCH_SUCCESS' })
      return
    }
    // cityId is set but query is pending and hasn't started fetching yet —
    // show spinner rather than leaving phase at its previous stale value.
    dispatchBoundary({ type: 'FETCH_START' })
  }, [cityId, isBoundaryFetching, isBoundaryError, boundaryQueryError, isBoundarySuccess])

  function clearCity() {}

  const value: CityData = {
    selectedCity,
    cityId,
    cityBoundary,
    boundaryPhase: boundaryState.phase,
    boundaryError: boundaryState.error,
    clearCity,
    selectCity,
  }

  return <CityContext.Provider value={value}>{children}</CityContext.Provider>
}
