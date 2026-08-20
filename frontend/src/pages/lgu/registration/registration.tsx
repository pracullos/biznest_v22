import { useSearch, useLoaderData } from '@tanstack/react-router'
import { ShieldX } from 'lucide-react'
import { BrandIcon } from '@/config/navigation'
import { AuthImagePanel } from '@/pages/auth/register/components/auth-image-panel'
import { CityAssignmentCard } from './components/city-assignment-card'
import { LguRegistrationForm } from './components/registration-form'
import { useLguRegistration } from './composables/use-lgu-registration'
import type { LguRegisterLoaderData } from '@/apps/lgu/register'
import type { Quote } from '@/config/quotes'

const LGU_QUOTE: Quote = {
  text: 'Manage your city data, zoning records, and hazard reports — all on BizNest.',
  author: 'BizNest',
}

function InvalidLink({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <div className="rounded-full bg-destructive/10 p-4">
          <ShieldX className="size-8 text-destructive" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Invalid invitation link</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}

export function LguRegistrationPage() {
  const { token, email } = useSearch({ from: '/lgu/register' })
  const loaderData = useLoaderData({ from: '/lgu/register' }) as LguRegisterLoaderData

  const form = useLguRegistration({ token, email })

  if (!loaderData.valid) {
    return <InvalidLink message={loaderData.error} />
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <AuthImagePanel quote={LGU_QUOTE} />

      <div className="flex flex-col items-center justify-center px-6 py-12 sm:px-12">
        <div className="mb-8 flex items-center gap-2 text-sm font-semibold lg:hidden">
          <BrandIcon className="size-4" />
          BizNest
        </div>

        <div className="w-full max-w-sm space-y-4">
          <CityAssignmentCard city={loaderData.city} />

          <LguRegistrationForm
            email={email}
            fullName={form.fullName}
            setFullName={form.setFullName}
            password={form.password}
            setPassword={form.setPassword}
            confirmPassword={form.confirmPassword}
            setConfirmPassword={form.setConfirmPassword}
            error={form.error}
            loading={form.loading}
            onSubmit={form.handleSubmit}
          />
        </div>
      </div>
    </div>
  )
}