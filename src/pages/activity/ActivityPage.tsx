import { Activity } from 'lucide-react'
import { ComingSoon } from '@/components/ui/ComingSoon'

export default function ActivityPage() {
  return (
    <ComingSoon
      title="Activity"
      icon={Activity}
      phase="Later phase"
      description="See new expenses, settlements and members across your trips as they happen."
    />
  )
}
