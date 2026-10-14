import { useState } from 'react'
import { useNavigate } from 'react-router'
import { AddPersonForm } from '@/components/members/AddPersonForm'
import { InvitePanel } from '@/components/members/InvitePanel'
import { MemberList } from '@/components/members/MemberList'
import { RenamePersonDialog } from '@/components/members/RenamePersonDialog'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { useTripContext } from '@/hooks/useTripContext'
import { useToast } from '@/hooks/useToast'
import { paths } from '@/routes/paths'

type Person = { id: string; name: string }

const listNames = (names: string[]) =>
  names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

export default function TripPeoplePage() {
  const { trip, members, currentUserId, isOwner, reload, copy, isBudget } = useTripContext()
  const navigate = useNavigate()
  const toast = useToast()
  const [renaming, setRenaming] = useState<Person | null>(null)
  const [inviting, setInviting] = useState<Person | null>(null)

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <Card className="overflow-hidden">
        <CardHeader
          title={`${copy.Members} (${members.length})`}
          description={
            isBudget
              ? 'Add everyone who shares this budget. A name is enough — they don’t need an account.'
              : 'Add everyone on this trip. A name is enough — they don’t need an account to be in the split.'
          }
        />
        <CardBody>
          <AddPersonForm
            tripId={trip.id}
            onAdded={(names) => {
              toast.success(`${listNames(names)} ${names.length === 1 ? 'is' : 'are'} on ${trip.name}.`)
              reload()
            }}
          />
        </CardBody>
        <div className="border-t border-slate-100">
          <MemberList
            tripId={trip.id}
            tripName={trip.name}
            noun={copy.noun}
            members={members}
            currentUserId={currentUserId}
            isOwner={isOwner}
            onRemoved={(_userId, self) => {
              if (self) {
                toast.show(`You left ${trip.name}.`)
                navigate(paths.trips, { replace: true })
              } else {
                toast.success(isBudget ? 'Removed from the budget.' : 'Removed from the trip.')
                reload()
              }
            }}
            onRename={(member) => setRenaming({ id: member.userId, name: member.profile.full_name })}
            onInvite={
              isOwner
                ? (member) => {
                    setInviting({ id: member.userId, name: member.profile.full_name })
                    document.getElementById('invite')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                : undefined
            }
          />
        </div>
      </Card>

      <Card id="invite" className="scroll-mt-24">
        <CardHeader
          title="Invite to the app"
          description={
            isOwner
              ? 'Optional — for anyone who wants to see this and add expenses themselves. You’ll get a link to send by Messenger, Viber, WhatsApp or text.'
              : `Optional — only the ${copy.noun} owner can invite people to the app.`
          }
        />
        {isOwner && (
          <CardBody>
            <InvitePanel tripId={trip.id} tripName={trip.name} person={inviting} onPersonDone={() => setInviting(null)} />
          </CardBody>
        )}
      </Card>

      <RenamePersonDialog
        person={renaming}
        onClose={() => setRenaming(null)}
        onRenamed={(name) => {
          toast.success(`Renamed to ${name}.`)
          setRenaming(null)
          reload()
        }}
      />
    </div>
  )
}
