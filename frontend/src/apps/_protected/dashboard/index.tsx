import { createFileRoute, redirect } from '@tanstack/react-router'
import { DashboardPage } from '@/pages/dashboard/dashboard'

export const Route = createFileRoute('/_protected/dashboard/')({
  beforeLoad: ({ context }) => {
    const { state } = context.auth
    // Only investors need city selection — admins and LGU admins go straight to dashboard
    if (state.state === 'AUTHENTICATED' && state.role_name === 'investor' && !state.city_id) {
      throw redirect({ to: '/city-setup', replace: true })
    }
  },
  component: DashboardPage,
})
