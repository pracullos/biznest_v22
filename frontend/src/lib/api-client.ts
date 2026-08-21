import createFetchClient from 'openapi-fetch'
import type { Middleware } from 'openapi-fetch'
import createClient from 'openapi-react-query'
import type { paths } from '@/types/api'
import { tokenManager } from '@/lib/token-manager'
import { ensureRefreshed, AUTH_PATHS } from '@/lib/auth-refresh'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

// Requests are keyed by openapi-fetch's per-call `id` so the 401 handler can
// retry against an unconsumed clone taken before the body stream was read.
const pendingClones = new Map<string, Request>()

const authMiddleware: Middleware = {
  onRequest({ request, id }) {
    const token = tokenManager.get()
    if (token) request.headers.set('Authorization', `Bearer ${token}`)
    pendingClones.set(id, request.clone())
  },
  async onResponse({ request, response, id }) {
    const original = pendingClones.get(id)
    pendingClones.delete(id)

    const isAuthPath = AUTH_PATHS.some(p => request.url.includes(p))
    if (response.status !== 401 || isAuthPath || !original) return undefined

    const freshToken = await ensureRefreshed()
    const headers = new Headers(original.headers)
    headers.set('Authorization', `Bearer ${freshToken}`)
    return fetch(new Request(original, { headers }))
  },
  onError({ id }) {
    pendingClones.delete(id)
  },
}

export const fetchClient = createFetchClient<paths>({
  baseUrl: BASE_URL,
  credentials: 'include',
  headers: { Accept: 'application/json' },
})

fetchClient.use(authMiddleware)

export const $api = createClient(fetchClient)

/** Unwrap an openapi-fetch `{data, error}` result into a thrown-on-error value, matching the axios call sites being migrated. */
export function unwrap<T>(res: { data?: T; error?: unknown }): T {
  if (res.error !== undefined) throw res.error
  return res.data as T
}
