import { RouterProvider } from '@tanstack/react-router'
import { useAuthContext } from '@/context/auth.context.ts'
import { router } from '@/router.ts'
import { queryClient } from '@/lib/query-client.ts'
import { Spinner } from '@/components/ui/spinner.tsx'

export function RouteContext() {
  const auth = useAuthContext()

  if (auth.state.state === 'BOOT' || auth.state.state === 'RESTORING') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner className="size-10" />
      </div>
    )
  }

  return <RouterProvider router={router} context={{ auth, queryClient }} />
}