import { useState, type FormEvent } from 'react'
import { LogOut } from 'lucide-react'
import { CurrencySelect } from '@/components/forms/CurrencySelect'
import { focusFirstInvalid } from '@/components/forms/controlStyles'
import { PasswordField } from '@/components/forms/PasswordField'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { PageHeader, PageTitle } from '@/components/ui/PageHeader'
import { useAuth, useCurrentUser } from '@/hooks/useAuth'
import { useSignOut } from '@/hooks/useSignOut'
import { useToast } from '@/hooks/useToast'
import { DEFAULT_CURRENCY } from '@/lib/currencies'
import { getErrorMessage } from '@/lib/errors'
import * as authService from '@/services/authService'
import {
  collectErrors,
  PASSWORD_HINT,
  validatePassword,
  validatePasswordConfirmation,
  type FieldErrors,
} from '@/utils/validation'

function CurrencySettings() {
  const { profile } = useCurrentUser()
  const { updateProfile } = useAuth()
  const toast = useToast()
  const saved = profile?.preferred_currency ?? DEFAULT_CURRENCY
  const [currency, setCurrency] = useState(saved)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      await updateProfile({ preferred_currency: currency })
      toast.success('Currency preference saved.')
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader title="Currency" description="Used as the default for new trips and for your dashboard totals." />
      <CardBody>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <CurrencySelect
            label="Preferred currency"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            containerClassName="flex-1"
          />
          <Button type="submit" loading={saving} disabled={!profile || currency === saved}>
            Save
          </Button>
        </form>
      </CardBody>
    </Card>
  )
}

type PasswordFieldName = 'password' | 'confirmation'

function PasswordSettings() {
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [errors, setErrors] = useState<FieldErrors<PasswordFieldName>>({})
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const found = collectErrors<PasswordFieldName>({
      password: validatePassword(password),
      confirmation: validatePasswordConfirmation(password, confirmation),
    })
    setErrors(found ?? {})
    if (found) return focusFirstInvalid(form)

    setSaving(true)
    try {
      await authService.updatePassword(password)
      setPassword('')
      setConfirmation('')
      toast.success('Password updated.')
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader title="Password" description="Change the password you use to log in." />
      <CardBody>
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {/* Lets password managers associate the new password with this account */}
          <input type="email" autoComplete="username" className="hidden" readOnly tabIndex={-1} aria-hidden />
          <PasswordField
            label="New password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={errors.password}
            hint={PASSWORD_HINT}
          />
          <PasswordField
            label="Confirm new password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            error={errors.confirmation}
          />
          <div className="flex justify-end">
            <Button type="submit" loading={saving} className="w-full sm:w-auto">
              Update password
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}

function AccountSettings() {
  const { user } = useCurrentUser()
  const { signOut, signingOut } = useSignOut()
  return (
    <Card>
      <CardHeader title="Account" />
      <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 text-sm text-slate-500">
          Logged in as <span className="font-semibold break-all text-slate-900">{user.email}</span>
        </p>
        <Button
          variant="outline"
          onClick={signOut}
          loading={signingOut}
          icon={<LogOut className="size-4" aria-hidden />}
          className="shrink-0"
        >
          Log out
        </Button>
      </CardBody>
    </Card>
  )
}

export default function SettingsPage() {
  return (
    <>
      <PageTitle title="Settings" />
      <PageHeader title="Settings" description="Manage your preferences and account." />
      <div className="max-w-3xl space-y-6">
        <CurrencySettings />
        <PasswordSettings />
        <AccountSettings />
      </div>
    </>
  )
}
