import { useEffect, useState, useSyncExternalStore, type FormEvent } from 'react'
import { useLocation } from 'react-router'
import { CircleCheck, Download, LogOut, Share } from 'lucide-react'
import { CurrencySelect } from '@/components/forms/CurrencySelect'
import { focusFirstInvalid } from '@/components/forms/controlStyles'
import { PasswordField } from '@/components/forms/PasswordField'
import { SelectField } from '@/components/forms/SelectField'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { PageHeader, PageTitle } from '@/components/ui/PageHeader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useAsync } from '@/hooks/useAsync'
import { useAuth, useCurrentUser } from '@/hooks/useAuth'
import { useSignOut } from '@/hooks/useSignOut'
import { useTheme } from '@/hooks/useTheme'
import { useToast } from '@/hooks/useToast'
import { DEFAULT_CURRENCY } from '@/lib/currencies'
import { getErrorMessage } from '@/lib/errors'
import { getInstallState, promptInstall, subscribeInstall } from '@/lib/installPrompt'
import type { ThemeChoice } from '@/lib/theme'
import * as authService from '@/services/authService'
import { listTripsOfflineFirst } from '@/services/tripService'
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

const ASK_EVERY_TIME = ''

function QuickAddSettings() {
  const { profile } = useCurrentUser()
  const { updateProfile } = useAuth()
  const toast = useToast()
  const { data: trips, error } = useAsync(listTripsOfflineFirst)
  const saved = profile?.default_trip_id ?? ASK_EVERY_TIME
  const [choice, setChoice] = useState(saved)
  const [saving, setSaving] = useState(false)

  // Open ones only, plus whatever is saved now (even if it has since ended), so the select shows it.
  const options = (trips ?? []).filter((trip) => trip.effectiveStatus !== 'completed' || trip.id === saved)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      await updateProfile({ default_trip_id: choice || null })
      toast.success(choice ? 'The + button now opens this one straight away.' : 'The + button will ask which one each time.')
    } catch (saveError) {
      toast.error(getErrorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card id="quick-add" className="scroll-mt-24">
      <CardHeader title="Quick add" description="Where an expense goes when you tap the + button." />
      <CardBody>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <SelectField
            label="When I tap +"
            value={choice}
            onChange={(event) => setChoice(event.target.value)}
            disabled={!trips}
            error={error && !trips ? getErrorMessage(error) : null}
            containerClassName="flex-1"
          >
            <option value={ASK_EVERY_TIME}>Ask me every time</option>
            {options.map((trip) => (
              <option key={trip.id} value={trip.id}>
                {trip.name}
                {trip.kind === 'budget' ? ' (monthly budget)' : ''}
              </option>
            ))}
          </SelectField>
          <Button type="submit" loading={saving} disabled={!profile || choice === saved}>
            Save
          </Button>
        </form>
      </CardBody>
    </Card>
  )
}

const THEME_OPTIONS: ReadonlyArray<{ value: ThemeChoice; label: string }> = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

function AppearanceSettings() {
  const { choice, setChoice } = useTheme()
  return (
    <Card>
      <CardHeader title="Appearance" description="System matches your phone or computer. Saved on this device." />
      <CardBody>
        <SegmentedControl label="Theme" value={choice} options={THEME_OPTIONS} onChange={setChoice} className="sm:max-w-sm" />
      </CardBody>
    </Card>
  )
}

function InstallSettings() {
  const state = useSyncExternalStore(subscribeInstall, getInstallState)
  const toast = useToast()

  async function install() {
    if (await promptInstall()) toast.success('TripSplit is installed. Open it from your home screen or app list.')
  }

  return (
    <Card id="install" className="scroll-mt-24">
      <CardHeader
        title="Install app"
        description="Open TripSplit from your home screen like any other app. Expenses you add without a connection are saved and sync later."
      />
      <CardBody>
        {state === 'installed' ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <CircleCheck className="size-5 shrink-0" aria-hidden />
            Installed on this device
          </p>
        ) : state === 'available' ? (
          <Button onClick={install} icon={<Download className="size-4" aria-hidden />} className="w-full sm:w-auto">
            Install TripSplit
          </Button>
        ) : state === 'ios' ? (
          <p className="text-sm text-slate-600">
            In Safari, tap <Share className="inline size-4 align-text-bottom" aria-label="Share" /> Share, then{' '}
            <span className="font-semibold text-slate-900">Add to Home Screen</span>.
          </p>
        ) : (
          <p className="text-sm text-slate-600">
            Your browser hasn’t offered to install from here. In Chrome or Edge, look for the install icon in the
            address bar or the menu; on Android, choose <span className="font-semibold text-slate-900">Add to Home screen</span>.
          </p>
        )}
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
  const { hash } = useLocation()

  // Links like /settings#quick-add: this page loads lazily, after the router's own scroll has run.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [hash])

  return (
    <>
      <PageTitle title="Settings" />
      <PageHeader title="Settings" description="Manage your preferences and account." />
      <div className="max-w-3xl space-y-6">
        <CurrencySettings />
        <QuickAddSettings />
        <AppearanceSettings />
        <InstallSettings />
        <PasswordSettings />
        <AccountSettings />
      </div>
    </>
  )
}
