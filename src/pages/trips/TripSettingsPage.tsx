import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeftRight, CircleCheckBig, LogOut, RotateCcw, Trash2 } from 'lucide-react'
import { CategoryBudgetsEditor } from '@/components/trips/CategoryBudgetsEditor'
import { CategoryManager } from '@/components/trips/CategoryManager'
import { ChangeCurrencyDialog } from '@/components/trips/ChangeCurrencyDialog'
import { TripForm } from '@/components/trips/TripForm'
import { tripToFormValues, type CoverChange } from '@/components/trips/tripFormValues'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useTripContext } from '@/hooks/useTripContext'
import { useToast } from '@/hooks/useToast'
import { getErrorMessage } from '@/lib/errors'
import { paths } from '@/routes/paths'
import { removeMember } from '@/services/memberService'
import {
  clearTripCover,
  deleteTrip,
  setTripCover,
  setTripStatus,
  updateTrip,
  type TripInput,
} from '@/services/tripService'
import { resizeImage } from '@/utils/image'
import { initialTripStatus } from '@/utils/tripStatus'

export default function TripSettingsPage() {
  const { trip, coverUrl, expenseCount, categories, isOwner, currentUserId, effectiveStatus, budgetMinor, reload } =
    useTripContext()
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const navigate = useNavigate()
  const toast = useToast()
  const [statusBusy, setStatusBusy] = useState(false)
  const [dialog, setDialog] = useState<'delete' | 'leave' | null>(null)
  const [dialogBusy, setDialogBusy] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  // Remount the form after a save so it starts from the saved values.
  const [formVersion, setFormVersion] = useState(0)

  async function saveDetails(input: TripInput, cover: CoverChange) {
    await updateTrip(trip.id, input)
    if (cover.kind === 'replace') await setTripCover(trip, await resizeImage(cover.file, 1600, 0.82))
    if (cover.kind === 'remove') await clearTripCover(trip)
    toast.success('Trip details saved.')
    setFormVersion((version) => version + 1)
    reload()
  }

  async function toggleCompleted() {
    setStatusBusy(true)
    try {
      const completing = effectiveStatus !== 'completed'
      await setTripStatus(trip.id, completing ? 'completed' : initialTripStatus(trip.start_date))
      toast.success(completing ? 'Trip marked as completed. 🎉' : 'Trip reopened.')
      reload()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setStatusBusy(false)
    }
  }

  function openDialog(kind: 'delete' | 'leave') {
    setDialogError(null)
    setDialog(kind)
  }

  async function confirmDialog() {
    setDialogBusy(true)
    setDialogError(null)
    try {
      if (dialog === 'delete') {
        await deleteTrip(trip)
        toast.success(`${trip.name} was deleted.`)
      } else {
        await removeMember(trip.id, currentUserId)
        toast.show(`You left ${trip.name}.`)
      }
      navigate(paths.trips, { replace: true })
    } catch (error) {
      setDialogError(getErrorMessage(error))
      setDialogBusy(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      {isOwner ? (
        <>
          <Card>
            <CardHeader title="Trip details" />
            <CardBody>
              <TripForm
                key={formVersion}
                tripId={trip.id}
                initial={tripToFormValues(trip)}
                coverUrl={coverUrl}
                currencyLocked={expenseCount > 0}
                submitLabel="Save changes"
                onSubmit={saveDetails}
              />
            </CardBody>
          </Card>

          {expenseCount > 0 && (
            <Card>
              <CardHeader
                title="Trip currency"
                description={`Everything is tracked in ${trip.currency}. Converting updates the budget, settlements and everyone's shares.`}
              />
              <CardBody>
                <Button variant="secondary" onClick={() => setCurrencyOpen(true)} icon={<ArrowLeftRight className="size-4" aria-hidden />}>
                  Change currency
                </Button>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Category budgets"
              description="Plan how much to spend per category. Analytics compares plan with actual spend."
            />
            <CardBody>
              <CategoryBudgetsEditor trip={trip} categories={categories} budgetMinor={budgetMinor} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Trip status"
              description={
                effectiveStatus === 'completed'
                  ? 'This trip is completed. Reopen it to add or change expenses.'
                  : 'When everyone has settled up, mark the trip as completed.'
              }
            />
            <CardBody>
              <Button
                variant={effectiveStatus === 'completed' ? 'outline' : 'secondary'}
                onClick={toggleCompleted}
                loading={statusBusy}
                icon={
                  effectiveStatus === 'completed' ? (
                    <RotateCcw className="size-4" aria-hidden />
                  ) : (
                    <CircleCheckBig className="size-4" aria-hidden />
                  )
                }
              >
                {effectiveStatus === 'completed' ? 'Reopen trip' : 'Mark as completed'}
              </Button>
            </CardBody>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader title="Trip settings" description="Only the trip owner can change the trip’s details, budget and categories." />
        </Card>
      )}

      <Card>
        <CardHeader title="Categories" description="Used to group expenses and power the analytics." />
        <CardBody>
          <CategoryManager tripId={trip.id} categories={categories} canManage={isOwner} onChanged={reload} />
        </CardBody>
      </Card>

      {isOwner ? (
        <Card tone="danger">
          <CardHeader title="Danger zone" description="Deleting a trip removes its expenses, settlements and members for everyone." />
          <CardBody>
            <Button variant="danger" onClick={() => openDialog('delete')} icon={<Trash2 className="size-4" aria-hidden />}>
              Delete trip
            </Button>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader title="Leave trip" description="You can leave as long as you haven’t paid for or shared in any expenses." />
          <CardBody>
            <Button variant="outline" onClick={() => openDialog('leave')} icon={<LogOut className="size-4" aria-hidden />}>
              Leave trip
            </Button>
          </CardBody>
        </Card>
      )}

      <ChangeCurrencyDialog
        open={currencyOpen}
        trip={trip}
        budgetMinor={budgetMinor}
        expenseCount={expenseCount}
        onClose={() => setCurrencyOpen(false)}
        onChanged={(currency) => {
          setCurrencyOpen(false)
          toast.success(`Trip converted to ${currency}.`)
          setFormVersion((version) => version + 1)
          reload()
        }}
      />

      <ConfirmDialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        onConfirm={confirmDialog}
        loading={dialogBusy}
        error={dialogError}
        title={dialog === 'delete' ? `Delete ${trip.name}?` : `Leave ${trip.name}?`}
        confirmLabel={dialog === 'delete' ? 'Delete trip' : 'Leave trip'}
        confirmText={dialog === 'delete' ? trip.name : undefined}
      >
        <p>
          {dialog === 'delete'
            ? `All ${expenseCount === 1 ? '1 expense' : `${expenseCount} expenses`}, settlements and invitations will be permanently deleted for every traveler. This can’t be undone.`
            : 'You’ll lose access to this trip. The owner can invite you again later.'}
        </p>
      </ConfirmDialog>
    </div>
  )
}
