import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { focusFirstInvalid } from '@/components/forms/controlStyles'
import { PasswordField } from '@/components/forms/PasswordField'
import { TextField } from '@/components/forms/TextField'
import { AuthHeader } from '@/components/layout/AuthHeader'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { PageTitle } from '@/components/ui/PageHeader'
import { getErrorMessage } from '@/lib/errors'
import { savePendingInvite } from '@/lib/pendingInvite'
import { paths } from '@/routes/paths'
import { isInvitePath, redirectTarget } from '@/routes/redirect'
import * as authService from '@/services/authService'
import { collectErrors, validateEmail, type FieldErrors } from '@/utils/validation'

type Field = 'email' | 'password'

export default function LoginPage() {
  // Kept in router state for <PublicOnlyRoute>, and carried over to "Create an account".
  const location = useLocation()
  const target = redirectTarget(location.state)
  const invited = isInvitePath(target)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors<Field>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const found = collectErrors<Field>({
      email: validateEmail(email),
      password: password ? null : 'Enter your password.',
    })
    setErrors(found ?? {})
    setFormError(null)
    if (found) return focusFirstInvalid(form)

    setSubmitting(true)
    // Survives a detour (e.g. "confirm your email first"); cleared on the invite page.
    if (invited && target) savePendingInvite(target, email)
    try {
      await authService.signIn(email, password)
      // <PublicOnlyRoute> redirects once the session is ready.
    } catch (error) {
      setFormError(getErrorMessage(error))
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageTitle title="Log in" />
      <AuthHeader
        title="Welcome back"
        description={
          invited
            ? 'Log in to accept your invitation.'
            : 'Log in to see your trips, budgets and balances.'
        }
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {formError && <Alert tone="error">{formError}</Alert>}

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
          autoComplete="current-password"
          enterKeyHint="go"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
          labelAction={
            <Link to={paths.forgotPassword} className="tap-target text-sm font-semibold text-primary-600 hover:text-primary-700">
              Forgot password?
            </Link>
          }
        />

        <Button type="submit" size="lg" fullWidth loading={submitting}>
          Log in
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-500">
        New to TripSplit?{' '}
        <Link to={paths.register} state={location.state} className="font-semibold text-primary-600 hover:text-primary-700">
          Create an account
        </Link>
      </p>
    </>
  )
}
