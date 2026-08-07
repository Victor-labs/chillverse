// src/features/profile/ProfileSkinStyles.tsx
//
// Injects PROFILE_SKIN_CSS into the document exactly once, no matter how
// many profile surfaces are mounted at the same time (a profile page can
// have a preview sheet open over it).
//
// Rendering a bare <style> per surface would work too, but duplicating a
// few KB of rules on every mount makes the DOM noisier for no gain, so
// this refcounts a single <style> node and removes it when the last
// skinned surface unmounts.
import { useEffect } from 'react'
import { PROFILE_SKIN_CSS } from '../../shared/lib/profileSkins'

const STYLE_ID = 'cv-profile-skin-styles'
let mounted = 0

export default function ProfileSkinStyles() {
  useEffect(() => {
    mounted += 1
    if (!document.getElementById(STYLE_ID)) {
      const el = document.createElement('style')
      el.id = STYLE_ID
      el.textContent = PROFILE_SKIN_CSS
      document.head.appendChild(el)
    }
    return () => {
      mounted -= 1
      if (mounted === 0) document.getElementById(STYLE_ID)?.remove()
    }
  }, [])

  return null
}
