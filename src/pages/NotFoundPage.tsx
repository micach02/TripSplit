import { Compass } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Logo } from '@/components/ui/Logo'
import { PageTitle } from '@/components/ui/PageHeader'
import { paths } from '@/routes/paths'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 p-4">
      <PageTitle title="Page not found" />
      <Logo />
      <Card className="w-full max-w-md">
        <EmptyState
          icon={Compass}
          title="Looks like you took a wrong turn"
          description="We couldn't find that page. It may have moved, or the link might be wrong."
          action={<ButtonLink to={paths.dashboard}>Back to TripSplit</ButtonLink>}
        />
      </Card>
    </div>
  )
}
