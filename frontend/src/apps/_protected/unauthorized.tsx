import { createFileRoute } from '@tanstack/react-router'
import { UnauthorizedPage } from '@/pages/errors/unauthorized'

export const Route = createFileRoute('/_protected/unauthorized')({
  component: UnauthorizedPage,
})
