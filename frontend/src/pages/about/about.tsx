import { GuestLayout } from '@/layout/GuestLayout'
import { Users } from 'lucide-react'

export function AboutPage() {
  return (
    <GuestLayout>
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-primary/10 p-4">
            <Users className="size-8 text-primary" />
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">About BizNest</h1>
        <p className="mt-3 text-muted-foreground max-w-md mx-auto">
          BizNest is a geo-intelligence platform built for investors and local government units in the Philippines.
          We provide city-scoped hazard data, land use zoning, and business establishment records to support
          smarter investment decisions.
        </p>
      </div>
    </GuestLayout>
  )
}
