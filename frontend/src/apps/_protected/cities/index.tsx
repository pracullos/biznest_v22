import { createFileRoute } from '@tanstack/react-router'
import { CitiesPage } from '@/pages/cities/cities'

export const Route = createFileRoute('/_protected/cities/')({
  component: CitiesPage,
})
