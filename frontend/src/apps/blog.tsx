import { createFileRoute } from '@tanstack/react-router'
import { BlogPage } from '@/pages/blog/blog'

export const Route = createFileRoute('/blog')({
  component: BlogPage,
})
