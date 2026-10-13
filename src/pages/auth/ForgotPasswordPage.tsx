import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, MailCheck } from 'lucide-react'
import { focusFirstInvalid } from '@/components/forms/controlStyles'
import { TextField } from '@/components/forms/TextField'
import { AuthHeader } from '@/components/layout/AuthHeader'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { PageTitle } from '@/components/ui/PageHeader'
import { getErrorMessage } from '@/lib/errors'
import { paths } from '@/routes/paths'
import * as authService from '@/services/authService'
import { validateEmail } from '@/utils/validation'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const emailError = validateEmail(email)
    setError(emailError)
    setFormError(null)
    if (emailError) return focusFirstInvalid(form)

    setSubmitting(true)
    try {
      await authService.requestPasswordReset(email)
      setSentTo(email.trim())
    } catch (caught) {
      setFormError(getErrorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  const backToLogin = (
    <Link
      to={paths.login}
      className="tap-target inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Back to log in
    </Link>
  )

  if (sentTo) {
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
                If an account exists for <strong className="text-slate-700">{sentTo}</strong>, you&apos;ll get a link to
                reset your password in a minute or two.
              </>
            }
          />
          {backToLogin}
        </div>
      </>
    )
  }

  return (
    <>
      <PageTitle title="Reset your password" />
      <AuthHeader title="Reset your password" description="Enter your email and we'll send you a link to set a new one." />

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {formError && <Alert tone="error">{formError}</Alert>}

        <TextField
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          enterKeyHint="send"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={error}
          placeholder="you@example.com"
        />

        <Button type="submit" size="lg" fullWidth loading={submitting}>
          Send reset link
        </Button>
      </form>

      <div className="mt-8 text-center">{backToLogin}</div>
    </>
  )
}
