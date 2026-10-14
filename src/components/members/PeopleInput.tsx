import { useId, useState, type KeyboardEvent } from 'react'
import { UserPlus, X } from 'lucide-react'
import { controlClasses } from '@/components/forms/controlStyles'
import { Button } from '@/components/ui/Button'
import { PERSON_NAME_MAX, splitNames, uniqueNames } from '@/utils/people'

interface PeopleInputProps {
  label: string
  hint: string
  value: string[]
  onChange: (names: string[]) => void
}

/**
 * A list of names typed before the trip exists (the create form). Enter or a
 * comma adds what's typed; leaving the box adds it too, so nothing typed is
 * lost when the form is submitted.
 */
export function PeopleInput({ label, hint, value, onChange }: PeopleInputProps) {
  const id = useId()
  const [text, setText] = useState('')

  function commit(raw: string) {
    const names = splitNames(raw).map((name) => name.slice(0, PERSON_NAME_MAX))
    if (names.length > 0) onChange(uniqueNames([...value, ...names]))
    setText('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      // Add the name instead of submitting the whole form.
      event.preventDefault()
      commit(text)
    } else if (event.key === 'Backspace' && text === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div>
      <label htmlFor={`${id}-name`} className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label}
      </label>
      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2" aria-label="Added">
          {value.map((name) => (
            <li key={name} className="flex items-center gap-1 rounded-full bg-blue-50 py-1 pr-1 pl-3 text-sm font-semibold text-blue-800">
              {name}
              <button
                type="button"
                onClick={() => onChange(value.filter((other) => other !== name))}
                className="rounded-full p-1.5 text-blue-700 hover:bg-blue-100"
                aria-label={`Remove ${name}`}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          id={`${id}-name`}
          value={text}
          onChange={(event) => {
            // Typing or pasting a comma adds what's before it.
            if (event.target.value.includes(',')) commit(event.target.value)
            else setText(event.target.value)
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => commit(text)}
          placeholder="Ben, Carl, Dana"
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="enter"
          aria-describedby={`${id}-hint`}
          className={controlClasses(false, 'min-w-0 flex-1')}
        />
        <Button
          variant="outline"
          onClick={() => commit(text)}
          disabled={!text.trim()}
          icon={<UserPlus className="size-4" aria-hidden />}
          className="h-12 shrink-0 sm:h-11"
        >
          Add
        </Button>
      </div>
      <p id={`${id}-hint`} className="mt-1.5 text-sm text-slate-500">
        {hint}
      </p>
    </div>
  )
}
