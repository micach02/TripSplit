import { useNavigate } from 'react-router'
import { InvitePanel } from '@/components/members/InvitePanel'
import { MemberList } from '@/components/members/MemberList'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { useTripContext } from '@/hooks/useTripContext'
import { useToast } from '@/hooks/useToast'
import { paths } from '@/routes/paths'

export default function TripPeoplePage() {
  const { trip, members, currentUserId, isOwner, reload } = useTripContext()
  const navigate = useNavigate()
  const toast = useToast()

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <Card className="overflow-hidden">
        <CardHeader
          title={`Travelers (${members.length})`}
          description="Everyone here can add expenses, see balances and record settlements."
        />
        <div className="mt-4 border-t border-slate-100">
          <MemberList
            tripId={trip.id}
            tripName={trip.name}
            members={members}
            currentUserId={currentUserId}
            isOwner={isOwner}
            onRemoved={(_userId, self) => {
              if (self) {
                toast.show(`You left ${trip.name}.`)
                navigate(paths.trips, { replace: true })
              } else {
                toast.success('Traveler removed.')
                reload()
              }
            }}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Invite friends"
          description={
            isOwner
              ? 'Create an invite, then send the link by Messenger, Viber, WhatsApp or text.'
              : 'Only the trip owner can invite people.'
          }
        />
        {isOwner && (
          <CardBody>
            <InvitePanel tripId={trip.id} tripName={trip.name} />
          </CardBody>
        )}
      </Card>
    </div>
  )
}
