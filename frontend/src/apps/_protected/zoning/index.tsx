import { createFileRoute, redirect } from '@tanstack/react-router'
import { ZoningPage } from '@/pages/zoning/zoning'
import { PERMISSION } from '@/config/permissions'

export const Route = createFileRoute('/_protected/zoning/')({
  beforeLoad: ({ context }) => {
    const auth = context.auth
    if (
      auth.state.state === 'AUTHENTICATED' &&
      !auth.state.permissions.includes(PERMISSION.ZONING_WRITE)
    ) {
      throw redirect({ to: '/unauthorized', replace: true })
    }
  },
  component: ZoningPage,
})
