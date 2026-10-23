import { highlightParts } from '@/utils/search'

/** Text with the searched-for words marked. */
export function Highlight({ text, terms }: { text: string; terms: readonly string[] }) {
  return (
    <>
      {highlightParts(text, terms).map((part, index) =>
        part.match ? (
          // A tint/ink pair that dark mode remaps together, so it reads in both themes.
          <mark key={index} className="rounded-sm bg-coral-100 px-0.5 text-coral-900">

            {part.text}
          </mark>
        ) : (
          part.text
        ),
      )}
    </>
  )
}
