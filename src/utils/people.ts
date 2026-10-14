import { firstName } from '@/utils/format'

/** Longest name for someone added by name (the database allows the same). */
export const PERSON_NAME_MAX = 60

/**
 * Names typed or pasted as one line: "Ben, Carl\nDana" → ["Ben", "Carl", "Dana"].
 * Commas and new lines separate names; blanks are dropped.
 */
export function splitNames(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((name) => name.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
}

/** Without repeats, ignoring case and spacing; the first spelling wins. */
export function uniqueNames(names: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of names) {
    const name = raw.trim().replace(/\s+/g, ' ')
    const key = name.toLowerCase()
    if (!name || seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out
}

/**
 * A name for tight spots (chips, rows, chart labels): the first name, or the
 * full name when one of `others` has the same first name ("Ben" and "Ben B").
 */
export function shortName(fullName: string, others: readonly string[]): string {
  const first = firstName(fullName)
  const key = first.toLowerCase()
  return others.some((other) => firstName(other).toLowerCase() === key) ? fullName.trim() : first
}

/** Someone added to a trip by name: they have no account. */
export function isNamedPerson(member: { profile: { guest_trip_id: string | null } }): boolean {
  return member.profile.guest_trip_id !== null
}
