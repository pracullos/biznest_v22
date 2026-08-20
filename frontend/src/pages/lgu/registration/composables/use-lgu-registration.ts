import { useState } from 'react'
import type { FormEvent } from 'react'
import type { AxiosError } from 'axios'
import { registerLguAdminUsersLguRegisterPost } from '@networking/api/generated/users/users'

function getErrorMessage(err: unknown): string {
  const axiosErr = err as AxiosError<{ detail?: string }>
  return axiosErr?.response?.data?.detail ?? 'Something went wrong. Please try again.'
}

interface UseLguRegistrationOptions {
  token: string
  email: string
}

export function useLguRegistration({ token, email }: UseLguRegistrationOptions) {
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (fullName.trim().length < 2) {
      setError('Full name must be at least 2 characters.')
      return
    }

    setLoading(true)
    try {
      await registerLguAdminUsersLguRegisterPost({ token, email, full_name: fullName.trim(), password })
      // Backend sets JWT cookie on registration — force full reload so AuthProvider
      // boots fresh, reads the cookie, and transitions to AUTHENTICATED.
      window.location.replace('/city-setup')
    } catch (err) {
      setError(getErrorMessage(err))
      setLoading(false)
    }
  }

  return {
    fullName, setFullName,
    password, setPassword,
    confirmPassword, setConfirmPassword,
    error, loading,
    handleSubmit,
  }
}