import { createFileRoute, redirect } from '@tanstack/react-router'
import { LoginPage } from '@/pages/auth/login/login'

export const Route = createFileRoute('/login')({
  beforeLoad: ({ context }) => {
    if (context.auth?.state?.state === 'AUTHENTICATED') {
      throw redirect({ to: '/dashboard', replace: true })
    }
  },
  component: LoginPage,
})