import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { LinkIcon } from 'lucide-react'
import { focusFirstInvalid } from '@/components/forms/controlStyles'
import { PasswordField } from '@/components/forms/PasswordField'
import { AuthHeader } from '@/components/layout/AuthHeader'
import { Alert } from '@/components/ui/Alert'
import { Button, ButtonLink } from '@/components/ui/Button'
import { PageTitle } from '@/components/ui/PageHeader'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { getErrorMessage } from '@/lib/errors'
import { paths } from '@/routes/paths'
import * as authService from '@/services/authService'
import {
  collectErrors,
  PASSWORD_HINT,
  validatePassword,
  validatePasswordConfirmation,
  type FieldErrors,
} from '@/utils/validation'

type Field = 'password' | 'confirmation'

/**
 * Landing page for the password-reset email. Supabase turns the link into a
 * short-lived session, so a signed-in user here is allowed to set a new password.
 */
export default function ResetPasswordPage() {
  const { status, clearPasswordRecovery } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [errors, setErrors] = useState<FieldErrors<Field>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const found = collectErrors<Field>({
      password: validatePassword(password),
      confirmation: validatePasswordConfirmation(password, confirmation),
    })
    setErrors(found ?? {})
    setFormError(null)
    if (found) return focusFirstInvalid(form)

    setSubmitting(true)
    try {
      await authService.updatePassword(password)
      clearPasswordRecovery()
      toast.success('Your password has been updated.')
      navigate(paths.dashboard, { replace: true })
    } catch (error) {
      setFormError(getErrorMessage(error))
      setSubmitting(false)
    }
  }

  if (status === 'loading') return <PageLoader label="Checking your reset link…" />

  if (status === 'unauthenticated') {
    return (
      <>
        <PageTitle title="Link expired" />
        <div className="text-center">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
            <LinkIcon className="size-8" aria-hidden />
          </div>
          <AuthHeader
            title="This link has expired"
            description="Password reset links work once and expire after an hour. Request a new one to continue."
          />
          <ButtonLink to={paths.forgotPassword} size="lg" fullWidth>
            Request a new link
          </ButtonLink>
          <Link to={paths.login} className="mt-6 inline-block text-sm font-semibold text-blue-600 hover:text-blue-700">
            Back to log in
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <PageTitle title="Choose a new password" />
      <AuthHeader title="Choose a new password" description="Pick something you haven't used for TripSplit before." />

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {formError && <Alert tone="error">{formError}</Alert>}

        <PasswordField
          label="New password"
          autoComplete="new-password"
          enterKeyHint="next"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
          hint={PASSWORD_HINT}
        />

        <PasswordField
          label="Confirm new password"
          autoComplete="new-password"
          enterKeyHint="done"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          error={errors.confirmation}
        />

        <Button type="submit" size="lg" fullWidth loading={submitting}>
          Update password
        </Button>
      </form>
    </>
  )
}
