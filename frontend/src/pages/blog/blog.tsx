import { GuestLayout } from '@/layout/GuestLayout'
import { BookOpen } from 'lucide-react'

export function BlogPage() {
  return (
    <GuestLayout>
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-primary/10 p-4">
            <BookOpen className="size-8 text-primary" />
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Blog</h1>
        <p className="mt-3 text-muted-foreground">
          Insights on geo-intelligence, city planning, and investment analytics. Coming soon.
        </p>
      </div>
    </GuestLayout>
  )
}
