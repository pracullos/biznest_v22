import type {Dispatch, FormEvent, SetStateAction} from 'react'
import {useState} from 'react'
import {Eye, EyeOff, Lock, Mail, User} from 'lucide-react'
import {Label} from '@/components/ui/label'
import {Button} from '@/components/ui/button'
import {Alert, AlertDescription} from '@/components/ui/alert'
import {Spinner} from '@/components/ui/spinner'
import {InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput,} from '@/components/ui/input-group'

interface LguRegistrationFormProps {
  email: string
  fullName: string
  setFullName: Dispatch<SetStateAction<string>>
  password: string
  setPassword: Dispatch<SetStateAction<string>>
  confirmPassword: string
  setConfirmPassword: Dispatch<SetStateAction<string>>
  error: string | null
  loading: boolean
  onSubmit: (e: FormEvent) => Promise<void>
}

export function LguRegistrationForm({
  email,
  fullName, setFullName,
  password, setPassword,
  confirmPassword, setConfirmPassword,
  error,
  loading,
  onSubmit,
}: LguRegistrationFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const passwordsMatch = confirmPassword === '' || password === confirmPassword

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Complete your registration</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set up your LGU administrator account.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <InputGroup>
            <InputGroupAddon>
              <Mail className="size-4" />
            </InputGroupAddon>
            <InputGroupInput
              id="email"
              type="email"
              value={email}
              disabled
              readOnly
            />
          </InputGroup>
          <p className="text-xs text-muted-foreground">Pre-filled from your invitation.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="full-name">Full Name</Label>
          <InputGroup>
            <InputGroupAddon>
              <User className="size-4" />
            </InputGroupAddon>
            <InputGroupInput
              id="full-name"
              type="text"
              placeholder="Juan dela Cruz"
              autoComplete="name"
              required
              minLength={2}
              maxLength={100}
              value={fullName}
              onChange={e => setFullName(e.target.value)}
            />
          </InputGroup>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <InputGroup>
            <InputGroupAddon>
              <Lock className="size-4" />
            </InputGroupAddon>
            <InputGroupInput
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton onClick={() => setShowPassword(v => !v)}>
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm-password">Confirm Password</Label>
          <InputGroup>
            <InputGroupAddon>
              <Lock className="size-4" />
            </InputGroupAddon>
            <InputGroupInput
              id="confirm-password"
              type={showConfirm ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="new-password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              aria-invalid={!passwordsMatch && confirmPassword !== '' ? true : undefined}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton onClick={() => setShowConfirm(v => !v)}>
                {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          {!passwordsMatch && confirmPassword !== '' && (
            <p className="text-xs text-destructive">Passwords do not match.</p>
          )}
        </div>

        <Button type="submit" className="mt-2 w-full" disabled={loading || (!passwordsMatch && confirmPassword !== '')}>
          {loading && <Spinner className="mr-2 size-4" />}
          Create LGU account
        </Button>
      </form>
    </div>
  )
}