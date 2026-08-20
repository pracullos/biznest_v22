import { createFileRoute, redirect } from '@tanstack/react-router'
import { HazardPage } from '@/pages/hazard/hazard.page'
import { PERMISSION } from '@/config/permissions'

export const Route = createFileRoute('/_protected/hazard/')({
  beforeLoad: ({ context }) => {
    const auth = context.auth
    if (
      auth.state.state === 'AUTHENTICATED' &&
      !auth.state.permissions.includes(PERMISSION.HAZARD_WRITE)
    ) {
      throw redirect({ to: '/unauthorized', replace: true })
    }
  },
  component: HazardPage,
})
