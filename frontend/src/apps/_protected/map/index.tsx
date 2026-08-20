import { createFileRoute } from '@tanstack/react-router'
import { MapPage } from '@/pages/map/map'

export const Route = createFileRoute('/_protected/map/')({
  component: MapPage,
})