import { useContext } from 'react'
import { InvitationsContext, type InvitationsContextValue } from '@/contexts/InvitationsContext'

const NONE: InvitationsContextValue = {
  invitations: [],
  error: undefined,
  alerts: [],
  dismissAlert: () => {},
  count: 0,
  refresh: () => {},
  refreshIfStale: () => {},
}

/** Invitations and budget alerts for the bell; empty outside the signed-in app shell. */
export function useInvitations(): InvitationsContextValue {
  return useContext(InvitationsContext) ?? NONE
}
