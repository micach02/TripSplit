import { useState, type FormEvent } from 'react'
import { TextField } from '@/components/forms/TextField'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { getErrorMessage } from '@/lib/errors'
import { renamePerson } from '@/services/memberService'
import { PERSON_NAME_MAX } from '@/utils/people'

interface Person {
  id: string
  name: string
}

interface RenamePersonDialogProps {
  person: Person | null
  onClose: () => void
  onRenamed: (name: string) => void
}

/** Renames someone added by name. */
export function RenamePersonDialog({ person, onClose, onRenamed }: RenamePersonDialogProps) {
  return (
    <Dialog open={person !== null} onClose={onClose} title={`Rename ${person?.name ?? ''}`} size="sm">
      {/* Remount per person so the field starts from their current name */}
      {person && <RenameForm key={person.id} person={person} onCancel={onClose} onRenamed={onRenamed} />}
    </Dialog>
  )
}

function RenameForm({ person, onCancel, onRenamed }: { person: Person; onCancel: () => void; onRenamed: (name: string) => void }) {
  const [name, setName] = useState(person.name)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = name.trim().replace(/\s+/g, ' ')
    if (!trimmed) return setError('Enter a name.')
    if (trimmed === person.name) return onCancel()

    setSaving(true)
    setError(null)
    try {
      await renamePerson(person.id, trimmed)
      onRenamed(trimmed)
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <TextField
        label="Name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={error}
        maxLength={PERSON_NAME_MAX}
        autoCapitalize="words"
        autoComplete="off"
        autoFocus
      />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          Save
        </Button>
      </div>
    </form>
  )
}
