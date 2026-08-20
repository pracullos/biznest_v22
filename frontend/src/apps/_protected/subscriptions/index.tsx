import { createFileRoute } from '@tanstack/react-router'
import { SubscriptionsPage } from '@/pages/subscriptions/subscriptions'

export const Route = createFileRoute('/_protected/subscriptions/')({
  component: SubscriptionsPage,
})
