/**
 * Search helpers shared by the Search page and the database search
 * (tripsplit.search_expenses splits words the same way).
 */

/** The words of a query: lower-cased, commas dropped ("4,800" → "4800"), at most 8. */
export function searchTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/,/g, ''))
    .filter(Boolean)
    .slice(0, 8)
}

/** True when every term appears somewhere in the texts (any order, ignoring case). */
export function matchesAll(texts: ReadonlyArray<string | null | undefined>, terms: readonly string[]): boolean {
  if (terms.length === 0) return false
  const haystack = texts.filter(Boolean).join(' ').toLowerCase()
  return terms.every((term) => haystack.includes(term))
}

export interface TextPart {
  text: string
  match: boolean
}

/** Splits text into plain and matching parts, for highlighting the words someone searched for. */
export function highlightParts(text: string, terms: readonly string[]): TextPart[] {
  const words = [...new Set(terms.filter(Boolean))].sort((a, b) => b.length - a.length)
  if (words.length === 0 || !text) return [{ text, match: false }]
  const escaped = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi')
  return text
    .split(pattern)
    .filter((part) => part !== '')
    .map((part) => ({ text: part, match: words.some((word) => word === part.toLowerCase()) }))
}

/** Recent searches, newest first, without repeats (ignoring case and spacing), at most `max`. */
export function addRecentSearch(recent: readonly string[], query: string, max = 6): string[] {
  const clean = query.trim().replace(/\s+/g, ' ')
  if (clean.length < 2) return [...recent]
  return [clean, ...recent.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, max)
}
