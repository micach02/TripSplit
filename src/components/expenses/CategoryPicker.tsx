import { useId } from 'react'
import { CircleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { Category } from '@/types/models'

interface CategoryPickerProps {
  categories: Category[]
  value: string
  onChange: (categoryId: string) => void
  error?: string | null
}

/** Big tappable category tiles — one tap instead of a dropdown. */
export function CategoryPicker({ categories, value, onChange, error }: CategoryPickerProps) {
  const labelId = useId()
  return (
    <div>
      <p id={labelId} className="mb-2 text-sm font-semibold text-slate-700">
        Category
      </p>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-invalid={error ? true : undefined}
        className="grid grid-cols-3 gap-2 min-[480px]:grid-cols-4 sm:grid-cols-5"
      >
        {categories.map((category) => {
          const selected = category.id === value
          return (
            <button
              key={category.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(category.id)}
              className={cn(
                'flex min-h-18 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center transition',
                selected
                  ? 'bg-blue-50 text-blue-800 ring-2 ring-blue-600'
                  : 'bg-surface text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
              )}
            >
              <span className="text-xl leading-none" aria-hidden>
                {category.icon}
              </span>
              {/* Wraps only at spaces; 3 columns on phones leave room for "Transportation" */}
              <span className="line-clamp-2 max-w-full px-1 text-[11px] leading-tight font-semibold">{category.name}</span>
            </button>
          )
        })}
      </div>
      {error && (
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-red-600">
          <CircleAlert className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  )
}
