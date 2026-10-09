import type { ReactNode } from 'react'

export function AuthHeader({ title, description }: { title: ReactNode; description?: ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
      {description && <p className="mt-2 text-slate-500">{description}</p>}
    </div>
  )
}
