// src/pages/ComingSoon.tsx
import { Link, useSearchParams } from 'react-router-dom'
import { Rocket } from 'lucide-react'

/**
 * Single reusable placeholder for every not-yet-built destination (Studio,
 * Mall, Achievements, Chat, Profile, Settings, Notifications, Join Session,
 * Halo AI, Go Premium, ...) so there are zero dead links anywhere in the
 * authenticated app shell.
 */
export default function ComingSoon() {
  const [searchParams] = useSearchParams()
  const feature = searchParams.get('feature') || 'This feature'

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="glass-panel-strong glow-violet-tint rounded-[22px] p-10 md:p-14 max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-chill-violet/15 flex items-center justify-center mx-auto mb-6">
          <Rocket size={28} className="text-chill-violetSoft" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">{feature}</h1>
        <p className="text-sm text-chill-textSecondary leading-relaxed mb-8">
          This is on our roadmap — we're building it out and it'll land in the verse soon.
        </p>
        <Link
          to="/dashboard"
          className="inline-block px-7 py-3 rounded-full text-sm font-semibold text-white bg-gradient-to-br from-chill-violet to-[#3d1fb5] shadow-[0_6px_28px_rgba(108,80,255,0.45)] hover:-translate-y-0.5 transition-all"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
