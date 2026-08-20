import { createFileRoute, redirect } from '@tanstack/react-router'
import { RegisterPage } from '@/pages/auth/register/register'

export const Route = createFileRoute('/register')({
  beforeLoad: ({ context }) => {
    if (context.auth?.state?.state === 'AUTHENTICATED') {
      throw redirect({ to: '/dashboard', replace: true })
    }
  },
  component: RegisterPage,
})