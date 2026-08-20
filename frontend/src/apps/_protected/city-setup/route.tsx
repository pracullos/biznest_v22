import { createFileRoute } from '@tanstack/react-router'
import { CitySetupLayout } from '@/layout/CitySetupLayout'

export const Route = createFileRoute('/_protected/city-setup')({
  component: CitySetupLayout,
})