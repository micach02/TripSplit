import { useId, useRef, useState, type FormEvent } from 'react'
import { UserPlus } from 'lucide-react'
import { controlClasses } from '@/components/forms/controlStyles'
import { Button } from '@/components/ui/Button'
import { getErrorMessage } from '@/lib/errors'
import { addPerson } from '@/services/memberService'
import { PERSON_NAME_MAX, splitNames, uniqueNames } from '@/utils/people'

interface AddPersonFormProps {
  tripId: string
  /** After at least one person was added, with their names. */
  onAdded: (names: string[]) => void
}

/**
 * Adds people to a trip by name — no account needed. Several at once with
 * commas ("Ben, Carl, Dana"); names that couldn't be added stay in the box.
 */
export function AddPersonForm({ tripId, onAdded }: AddPersonFormProps) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const names = uniqueNames(splitNames(text))
    const tooLong = names.find((name) => name.length > PERSON_NAME_MAX)
    if (names.length === 0 || tooLong) {
      setError(tooLong ? `Keep each name to ${PERSON_NAME_MAX} characters.` : 'Enter a name.')
      input.current?.focus()
      return
    }

    setSaving(true)
    setError(null)
    const added: string[] = []
    const failed: string[] = []
    let firstError: unknown = null
    for (const name of names) {
      try {
        await addPerson(tripId, name)
        added.push(name)
      } catch (caught) {
        failed.push(name)
        firstError ??= caught
      }
    }
    setSaving(false)

    // What couldn't be added stays, so it can be fixed and tried again.
    setText(failed.join(', '))
    if (failed.length > 0) {
      setError(failed.length === 1 ? getErrorMessage(firstError) : `Couldn’t add ${failed.join(', ')}: ${getErrorMessage(firstError)}`)
    }
    if (added.length > 0) onAdded(added)
    input.current?.focus()
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label htmlFor={`${id}-name`} className="mb-1.5 block text-sm font-semibold text-slate-700">
        Add someone
      </label>
      <div className="flex gap-2">
        <input
          ref={input}
          id={`${id}-name`}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Ben, Carl, Dana"
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="done"
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-${error ? 'error' : 'hint'}`}
          className={controlClasses(Boolean(error), 'min-w-0 flex-1')}
        />
        <Button type="submit" loading={saving} icon={<UserPlus className="size-4" aria-hidden />} className="h-12 shrink-0 sm:h-11">
          Add
        </Button>
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-red-600">
          {error}
        </p>
      ) : (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-slate-500">
          Just a name — they don’t need an account. Add several at once with commas.
        </p>
      )}
    </form>
  )
}
