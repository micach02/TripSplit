import { useRef, useState, type ChangeEvent } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useAuth, useCurrentUser } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { getErrorMessage } from '@/lib/errors'
import { removeAvatar, uploadAvatar } from '@/services/storageService'
import { checkImageFile, IMAGE_ACCEPT, resizeImage } from '@/utils/image'

/** Raw photos straight off a phone; they're shrunk to ~50 KB before upload. */
const MAX_SOURCE_BYTES = 15 * 1024 * 1024

export function AvatarUploader() {
  const { user, profile, displayName } = useCurrentUser()
  const { updateProfile } = useAuth()
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null)
  const avatarUrl = profile?.avatar_url ?? null

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // allow choosing the same file again
    if (!file) return

    setBusy('upload')
    const problem = await checkImageFile(file, MAX_SOURCE_BYTES)
    if (problem) {
      toast.error(problem)
      setBusy(null)
      return
    }
    try {
      const resized = await resizeImage(file, 512)
      const url = await uploadAvatar(user.id, resized)
      await updateProfile({ avatar_url: url })
      void removeAvatar(avatarUrl).catch(() => undefined)
      toast.success('Profile photo updated.')
    } catch (error) {
      toast.error(getErrorMessage(error, "Couldn't upload your photo. Please try again."))
    } finally {
      setBusy(null)
    }
  }

  async function handleRemove() {
    setBusy('remove')
    try {
      await updateProfile({ avatar_url: null })
      void removeAvatar(avatarUrl).catch(() => undefined)
      toast.success('Profile photo removed.')
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative">
        <Avatar name={displayName} src={avatarUrl} size="xl" decorative />
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-surface/70 text-blue-600">
            <Spinner className="size-7" />
          </span>
        )}
      </div>
      <div className="flex flex-col items-center gap-2 sm:items-start">
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={<Camera className="size-4" aria-hidden />}
            onClick={() => inputRef.current?.click()}
            loading={busy === 'upload'}
            disabled={busy !== null}
          >
            {avatarUrl ? 'Change photo' : 'Add photo'}
          </Button>
          {avatarUrl && (
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 className="size-4" aria-hidden />}
              onClick={handleRemove}
              loading={busy === 'remove'}
              disabled={busy !== null}
            >
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-slate-500">JPG, PNG or WEBP. We&apos;ll resize it for you.</p>
        <input
          ref={inputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={handleFile}
        />
      </div>
    </div>
  )
}
