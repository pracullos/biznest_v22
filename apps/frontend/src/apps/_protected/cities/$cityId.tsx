import { createFileRoute } from '@tanstack/react-router'
import { CityDetailPage } from '@/pages/cities/city-detail.page'

export const Route = createFileRoute('/_protected/cities/$cityId')({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (search.tab as 'overview' | 'establishments') ?? 'overview',
  }),
  component: CityDetailPage,
})
