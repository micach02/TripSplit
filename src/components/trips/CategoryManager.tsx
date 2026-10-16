import { useState, type FormEvent } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { CategoryIcon } from '@/components/expenses/CategoryIcon'
import { TextField } from '@/components/forms/TextField'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Dialog } from '@/components/ui/Dialog'
import { cn } from '@/lib/cn'
import { getErrorMessage } from '@/lib/errors'
import { createCategory, deleteCategory, updateCategory } from '@/services/categoryService'
import type { Category } from '@/types/models'

const EMOJI = ['🍜', '🍔', '☕', '🍺', '🚕', '🚌', '🚆', '⛽', '🏨', '✈️', '🎢', '🎟️', '🛍️', '🎁', '💊', '🧴', '📱', '🧺', '🏖️', '🚑', '💡', '🏷️']
const COLORS = ['#f97316', '#ef4444', '#ec4899', '#d946ef', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#14b8a6', '#22c55e', '#eab308', '#64748b']

interface Draft {
  id?: string
  name: string
  icon: string
  color: string
}

interface CategoryManagerProps {
  tripId: string
  categories: Category[]
  canManage: boolean
  onChanged: () => void
}

export function CategoryManager({ tripId, categories, canManage, onChanged }: CategoryManagerProps) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function open(next: Draft) {
    setError(null)
    setDraft(next)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft) return
    const name = draft.name.trim()
    if (!name) return setError('Give the category a name.')
    if (!draft.icon.trim()) return setError('Pick an emoji.')

    setSaving(true)
    setError(null)
    try {
      const input = { name, icon: draft.icon.trim(), color: draft.color }
      if (draft.id) await updateCategory(draft.id, input)
      else await createCategory(tripId, input)
      setDraft(null)
      onChanged()
    } catch (caught) {
      setError(
        (caught as { code?: string } | null)?.code === '23505'
          ? 'There’s already a category with that name.'
          : getErrorMessage(caught),
      )
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteCategory(toDelete.id)
      setToDelete(null)
      onChanged()
    } catch (caught) {
      setDeleteError(getErrorMessage(caught))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {categories.map((category) => (
          <li key={category.id} className="flex items-center gap-3 rounded-xl px-3 py-2 ring-1 ring-slate-200">
            <CategoryIcon icon={category.icon} color={category.color} size="sm" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{category.name}</span>
            {!category.is_default && <Badge tone="primary">Custom</Badge>}
            {canManage && (
              <span className="flex">
                <button
                  type="button"
                  onClick={() => open({ id: category.id, name: category.name, icon: category.icon, color: category.color })}
                  className="rounded-lg p-3.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 sm:p-2"
                  aria-label={`Edit ${category.name}`}
                >
                  <Pencil className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError(null)
                    setToDelete(category)
                  }}
                  className="rounded-lg p-3.5 text-slate-500 hover:bg-red-50 hover:text-red-600 sm:p-2"
                  aria-label={`Delete ${category.name}`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>

      {canManage && (
        <Button
          variant="secondary"
          className="mt-4"
          icon={<Plus className="size-4" aria-hidden />}
          onClick={() => open({ name: '', icon: '🏷️', color: COLORS[7] })}
        >
          Add category
        </Button>
      )}

      <Dialog
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Edit category' : 'New category'}
        size="sm"
      >
        {draft && (
          <form onSubmit={save} className="space-y-5" noValidate>
            {error && <Alert tone="error">{error}</Alert>}
            <div className="flex items-center gap-3">
              <CategoryIcon icon={draft.icon || '🏷️'} color={draft.color} size="lg" />
              <TextField
                label="Name"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                maxLength={40}
                placeholder="Emergency"
                containerClassName="flex-1"
                autoFocus
              />
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-slate-700">Emoji</legend>
              <div className="flex flex-wrap gap-1.5">
                {EMOJI.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setDraft({ ...draft, icon: emoji })}
                    aria-pressed={draft.icon === emoji}
                    className={cn(
                      'flex size-11 items-center justify-center rounded-xl text-xl transition',
                      draft.icon === emoji ? 'bg-primary-50 ring-2 ring-primary-600' : 'ring-1 ring-slate-200 hover:bg-slate-50',
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <TextField
                label="Or type any emoji"
                value={draft.icon}
                onChange={(event) => setDraft({ ...draft, icon: event.target.value })}
                maxLength={8}
                containerClassName="mt-3 max-w-40"
              />
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-slate-700">Colour</legend>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setDraft({ ...draft, color })}
                    aria-label={`Colour ${color}`}
                    aria-pressed={draft.color === color}
                    className={cn(
                      'size-9 rounded-full ring-offset-2 transition',
                      draft.color === color ? 'ring-2 ring-slate-900' : 'hover:scale-110',
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </fieldset>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setDraft(null)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                {draft.id ? 'Save' : 'Add category'}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        error={deleteError}
        title={`Delete “${toDelete?.name ?? ''}”?`}
        confirmLabel="Delete category"
      >
        <p>Categories that are used by expenses can’t be deleted.</p>
      </ConfirmDialog>
    </>
  )
}
