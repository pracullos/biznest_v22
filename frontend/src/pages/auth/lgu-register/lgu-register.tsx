import { BrandIcon } from '@/config/navigation'
import { AuthImagePanel } from '@/pages/auth/register/components/auth-image-panel'
import { RegisterForm } from '@/pages/auth/register/components/register-form'
import { useLguRegisterForm } from './composables/use-lgu-register-form'
import type { Quote } from '@/config/quotes'

const LGU_QUOTE: Quote = {
  text: 'Manage your city data, zoning records, and hazard reports — all on BizNest.',
  author: 'BizNest',
}

export function LguRegisterPage() {
  const form = useLguRegisterForm()

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <AuthImagePanel quote={LGU_QUOTE} />

      <div className="flex flex-col items-center justify-center px-6 py-12 sm:px-12">
        <div className="mb-8 flex items-center gap-2 text-sm font-semibold lg:hidden">
          <BrandIcon className="size-4" />
          BizNest
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="text-xs font-medium text-primary">LGU Administrator Registration</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              This account will have full city management permissions.
            </p>
          </div>
          <RegisterForm
            email={form.email}
            setEmail={form.setEmail}
            fullName={form.fullName}
            setFullName={form.setFullName}
            password={form.password}
            setPassword={form.setPassword}
            error={form.error}
            loading={form.loading}
            onSubmit={form.handleSubmit}
          />
        </div>
      </div>
    </div>
  )
}
