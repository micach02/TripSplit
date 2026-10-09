import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { getErrorMessage } from '@/lib/errors'

/** Signs out with error feedback; <ProtectedRoute> handles the redirect. */
export function useSignOut() {
  const { signOut } = useAuth()
  const toast = useToast()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
    } catch (error) {
      toast.error(getErrorMessage(error, "Couldn't log you out. Please try again."))
      setSigningOut(false)
    }
  }

  return { signOut: handleSignOut, signingOut }
}
