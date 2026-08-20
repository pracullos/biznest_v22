import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import type { AuthData } from '@/context/auth.context'
import type { QueryClient } from '@tanstack/react-query'

export interface RouterContext {
  auth: AuthData
  queryClient: QueryClient
}

export const router = createRouter({
  routeTree,
  context: {
    auth: undefined!,
    queryClient: undefined!,
  },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}