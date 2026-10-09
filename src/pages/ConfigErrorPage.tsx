import { KeyRound } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Logo } from '@/components/ui/Logo'
import type { EnvProblem } from '@/lib/env'

/** Shown instead of the app when the Supabase environment variables are unusable. */
export default function ConfigErrorPage({ problem }: { problem: EnvProblem }) {
  const privileged = problem === 'privileged-key'
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 p-4">
      <Logo />
      <Card className="w-full max-w-lg p-6 sm:p-8">
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
          <KeyRound className="size-6" aria-hidden />
        </div>
        <h1 className="text-xl font-extrabold text-slate-900">
          {privileged ? 'Unsafe Supabase key detected' : 'TripSplit isn’t connected yet'}
        </h1>
        {import.meta.env.DEV ? (
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600">
            {privileged ? (
              <p>
                <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_ANON_KEY</code> holds a{' '}
                <strong>service-role / secret key</strong>. That key bypasses Row Level Security and must never be
                shipped to a browser. Replace it with the anon (publishable) key and rotate the secret key if it was
                ever deployed.
              </p>
            ) : problem === 'invalid-url' ? (
              <p>
                <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_URL</code> isn&apos;t a valid URL. Use your
                project URL, e.g. <code className="rounded bg-slate-100 px-1">https://&lt;ref&gt;.supabase.co</code>, then
                restart the dev server.
              </p>
            ) : (
              <p>
                Copy <code className="rounded bg-slate-100 px-1">.env.example</code> to{' '}
                <code className="rounded bg-slate-100 px-1">.env</code> and fill in{' '}
                <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_URL</code> and{' '}
                <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_ANON_KEY</code>, then restart the dev server.
                For local development run <code className="rounded bg-slate-100 px-1">npm run db:start</code> to get
                both values.
              </p>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">
            TripSplit is temporarily unavailable. Please try again later.
          </p>
        )}
      </Card>
    </div>
  )
}
