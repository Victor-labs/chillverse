// src/context/ProfilePreview.tsx
//
// App-wide "quick profile" overlay — the Discord-style card that pops up
// when you tap ANY avatar in the app. Mounted once near the root (see
// App.tsx) and portaled to document.body so it always sits above
// everything, regardless of which page/modal triggered it.
import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import ProfilePreviewModal from '../features/profile/ProfilePreviewModal'

interface ProfilePreviewCtx {
  openProfilePreview: (userId: string) => void
  closeProfilePreview: () => void
}

const Ctx = createContext<ProfilePreviewCtx | null>(null)

export function ProfilePreviewProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)

  const openProfilePreview = useCallback((id: string) => setUserId(id), [])
  const closeProfilePreview = useCallback(() => setUserId(null), [])

  return (
    <Ctx.Provider value={{ openProfilePreview, closeProfilePreview }}>
      {children}
      {userId && createPortal(
        <ProfilePreviewModal userId={userId} onClose={closeProfilePreview} />,
        document.body,
      )}
    </Ctx.Provider>
  )
}

/** Throws if used outside the provider — use this in code that's always mounted inside App. */
export function useProfilePreview(): ProfilePreviewCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useProfilePreview must be used within a ProfilePreviewProvider')
  return ctx
}

/** Safe version for shared/leaf components (like Avatar) that may render before the provider mounts. */
export function useProfilePreviewOptional(): ProfilePreviewCtx | null {
  return useContext(Ctx)
}
