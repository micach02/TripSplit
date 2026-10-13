import { createContext } from 'react'
import type { MyInvitation } from '@/services/memberService'
import type { BudgetAlert } from '@/utils/calculations/insights'

/** What the bell knows about: trip/budget invitations and budget alerts. */
export interface InvitationsContextValue {
  /** Trip invitations waiting for the signed-in user; undefined until first loaded */
  invitations: MyInvitation[] | undefined
  /** Set when the latest load failed and there's nothing to show */
  error: unknown
  /** Budget alerts not dismissed yet (90% used, over budget) */
  alerts: BudgetAlert[]
  /** Hide an alert until it gets worse (or next month) */
  dismissAlert: (id: string) => void
  /** Invitations + alerts, for the badge */
  count: number
  /** Re-check now, e.g. after answering an invitation or adding an expense */
  refresh: () => void
  /** Re-check only if the list is older than `maxAgeMs` (and not already loading) */
  refreshIfStale: (maxAgeMs: number) => void
}

export const InvitationsContext = createContext<InvitationsContextValue | null>(null)
