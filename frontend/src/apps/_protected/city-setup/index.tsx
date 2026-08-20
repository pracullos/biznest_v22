import { createFileRoute } from '@tanstack/react-router'
import { CitySetupPage } from '@/pages/city-setup/city-setup'

export const Route = createFileRoute('/_protected/city-setup/')({
  component: CitySetupPage,
})
