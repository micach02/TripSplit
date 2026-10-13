import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { MailCheck } from 'lucide-react'
import { focusFirstInvalid } from '@/components/forms/controlStyles'
import { PasswordField } from '@/components/forms/PasswordField'
import { TextField } from '@/components/forms/TextField'
import { AuthHeader } from '@/components/layout/AuthHeader'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { PageTitle } from '@/components/ui/PageHeader'
import { useToast } from '@/hooks/useToast'
import { getErrorMessage } from '@/lib/errors'
import { savePendingInvite } from '@/lib/pendingInvite'
import { paths } from '@/routes/paths'
import { isInvitePath, redirectTarget } from '@/routes/redirect'
import * as authService from '@/services/authService'
import { collectErrors, PASSWORD_HINT, validateEmail, validateFullName, validatePassword, type FieldErrors } from '@/utils/validation'

type Field = 'fullName' | 'email' | 'password'

export default function RegisterPage() {
  const toast = useToast()
  const location = useLocation()
  const target = redirectTarget(location.state)
  const invited = isInvitePath(target)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors<Field>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const found = collectErrors<Field>({
      fullName: validateFullName(fullName),
      email: validateEmail(email),
      password: validatePassword(password),
    })
    setErrors(found ?? {})
    setFormError(null)
    if (found) return focusFirstInvalid(form)

    setSubmitting(true)
    try {
      const { needsEmailConfirmation } = await authService.signUp({
        fullName,
        email,
        password,
        redirectPath: target ?? paths.dashboard,
      })
      if (needsEmailConfirmation) {
        // The confirmation email might not bring them straight back to the invite.
        if (invited && target) savePendingInvite(target, email)
        setConfirmationSentTo(email.trim())
        setSubmitting(false)
      } else {
        toast.success('Welcome to TripSplit! 🎉')
        // <PublicOnlyRoute> redirects to where they were going (or the dashboard).
      }
    } catch (error) {
      setFormError(getErrorMessage(error))
      setSubmitting(false)
    }
  }

  if (confirmationSentTo) {
    return (
      <>
        <PageTitle title="Check your email" />
        <div className="text-center">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <MailCheck className="size-8" aria-hidden />
          </div>
          <AuthHeader
            title="Check your email"
            description={
              <>
                We sent a confirmation link to <strong className="text-slate-700">{confirmationSentTo}</strong>. Open it
                to activate your account{invited && ' — it brings you back to your trip invitation'}.
              </>
            }
          />
          <Link to={paths.login} state={location.state} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
            Back to log in
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <PageTitle title="Create your account" />
      <AuthHeader
        title="Create your account"
        description={
          invited
            ? 'Create a free account to accept your invitation.'
            : 'Start tracking and splitting trip expenses in minutes.'
        }
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {formError && <Alert tone="error">{formError}</Alert>}

        <TextField
          label="Full name"
          autoComplete="name"
          autoCapitalize="words"
          enterKeyHint="next"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          error={errors.fullName}
          placeholder="Michael Reyes"
          maxLength={100}
        />

        <TextField
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          enterKeyHint="next"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
          placeholder="you@example.com"
        />

        <PasswordField
          label="Password"
          autoComplete="new-password"
          enterKeyHint="go"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
          hint={PASSWORD_HINT}
        />

        <Button type="submit" size="lg" fullWidth loading={submitting}>
          Create account
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link to={paths.login} state={location.state} className="font-semibold text-blue-600 hover:text-blue-700">
          Log in
        </Link>
      </p>
    </>
  )
}
