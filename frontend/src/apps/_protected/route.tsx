import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthenticatedLayout } from '@/layout/AuthenticatedLayout'

export const Route = createFileRoute('/_protected')({
  beforeLoad: ({ context }) => {
    if (!context.auth || context.auth.state?.state !== 'AUTHENTICATED') {
      throw redirect({ to: '/login', replace: true })
    }
  },
  component: AuthenticatedLayout,
})

