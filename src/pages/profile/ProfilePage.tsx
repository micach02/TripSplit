import { useState, type FormEvent } from 'react'
import { CalendarDays, ChevronRight, LogOut, Mail, Settings } from 'lucide-react'
import { Link } from 'react-router'
import { CurrencySelect } from '@/components/forms/CurrencySelect'
import { focusFirstInvalid } from '@/components/forms/controlStyles'
import { TextField } from '@/components/forms/TextField'
import { AvatarUploader } from '@/components/profile/AvatarUploader'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { PageHeader, PageTitle } from '@/components/ui/PageHeader'
import { useAuth, useCurrentUser } from '@/hooks/useAuth'
import { useSignOut } from '@/hooks/useSignOut'
import { useToast } from '@/hooks/useToast'
import { getErrorMessage } from '@/lib/errors'
import { paths } from '@/routes/paths'
import type { Profile } from '@/types/models'
import { formatLongDate } from '@/utils/format'
import { validateFullName } from '@/utils/validation'

function ProfileForm({ profile }: { profile: Profile }) {
  const { updateProfile } = useAuth()
  const toast = useToast()
  const [fullName, setFullName] = useState(profile.full_name)
  const [currency, setCurrency] = useState(profile.preferred_currency)
  const [nameError, setNameError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const dirty = fullName.trim() !== profile.full_name || currency !== profile.preferred_currency

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const error = validateFullName(fullName)
    setNameError(error)
    if (error) return focusFirstInvalid(form)

    setSaving(true)
    try {
      const saved = await updateProfile({ full_name: fullName.trim(), preferred_currency: currency })
      setFullName(saved.full_name)
      toast.success('Profile saved.')
    } catch (caught) {
      toast.error(getErrorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <TextField
        label="Full name"
        autoComplete="name"
        autoCapitalize="words"
        maxLength={100}
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
        error={nameError}
      />
      <TextField
        label="Email"
        type="email"
        value={profile.email}
        readOnly
        disabled
        hint="Used to log in and to receive trip invitations."
      />
      <CurrencySelect
        label="Preferred currency"
        value={currency}
        onChange={(event) => setCurrency(event.target.value)}
        hint="The default for new trips and your dashboard totals."
      />
      <div className="flex justify-end">
        <Button type="submit" loading={saving} disabled={!dirty} className="w-full sm:w-auto">
          Save changes
        </Button>
      </div>
    </form>
  )
}

function ProfileUnavailable() {
  const { refreshProfile } = useAuth()
  const toast = useToast()
  const [retrying, setRetrying] = useState(false)

  async function retry() {
    setRetrying(true)
    try {
      await refreshProfile()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setRetrying(false)
    }
  }

  return (
    <Alert tone="error" title="We couldn't load your profile">
      <Button variant="outline" size="sm" className="mt-2" onClick={retry} loading={retrying}>
        Try again
      </Button>
    </Alert>
  )
}

export default function ProfilePage() {
  const { user, profile } = useCurrentUser()
  const { signOut, signingOut } = useSignOut()

  return (
    <>
      <PageTitle title="Profile" />
      <PageHeader title="Profile" description="How you appear to the people you share budgets and trips with." />

      {!profile ? (
        <ProfileUnavailable />
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card>
            <CardBody className="space-y-8">
              <AvatarUploader />
              <ProfileForm profile={profile} />
            </CardBody>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader title="Account" />
              <CardBody>
                <dl className="space-y-4 text-sm">
                  <div className="min-w-0">
                    <dt className="flex items-center gap-2 text-slate-500">
                      <Mail className="size-4 shrink-0" aria-hidden />
                      Email
                    </dt>
                    <dd className="truncate pl-6 font-semibold text-slate-900">{profile.email || user.email}</dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-2 text-slate-500">
                      <CalendarDays className="size-4 shrink-0" aria-hidden />
                      Member since
                    </dt>
                    <dd className="pl-6 font-semibold text-slate-900">{formatLongDate(profile.created_at)}</dd>
                  </div>
                </dl>
              </CardBody>
            </Card>

            <Card className="overflow-hidden">
              <Link
                to={paths.settings}
                className="flex items-center gap-3 px-5 py-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Settings className="size-5 text-slate-400" aria-hidden />
                <span className="flex-1">Settings</span>
                <ChevronRight className="size-5 text-slate-300" aria-hidden />
              </Link>
              <button
                type="button"
                onClick={signOut}
                disabled={signingOut}
                className="flex w-full items-center gap-3 border-t border-slate-100 px-5 py-4 text-left text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                <LogOut className="size-5" aria-hidden />
                Log out
              </button>
            </Card>
          </div>
        </div>
      )}
    </>
  )
}
