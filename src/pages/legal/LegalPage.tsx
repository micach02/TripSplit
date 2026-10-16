import type { ReactNode } from 'react'
import { PageTitle } from '@/components/ui/PageHeader'
import { cn } from '@/lib/cn'

/** Shared frame for the Privacy and Terms pages: a readable column of prose. */
export function LegalPage({ title, updated, intro, children }: { title: string; updated: string; intro: ReactNode; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
      <PageTitle title={title} />
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated {updated}</p>
      <div className="mt-6 text-lg text-slate-700">{intro}</div>
      <div className="mt-10 space-y-10">{children}</div>
    </article>
  )
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-slate-700">{children}</div>
    </section>
  )
}

export function LegalList({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn('list-disc space-y-2 pl-5 marker:text-slate-400', className)}>{children}</ul>
}

const linkClass = 'font-semibold text-primary-600 underline-offset-2 hover:text-primary-700 hover:underline'

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={linkClass}>
      {children}
    </a>
  )
}

/** Where to send questions and requests. */
export function ContactLink() {
  return <ExternalLink href="https://github.com/micach02/TripSplit/issues">TripSplit on GitHub</ExternalLink>
}
