// src/features/blog/UpdateLog.tsx
//
// Chillverse's version of Discord's "Patch Notes." Rather than a parallel
// changelog_entries table + separate editor, this reuses blog_posts with
// series = 'update-log' — an admin publishes a release note through the
// same /blog/admin editor already built, tags it "update-log", and it
// appears here automatically. Each entry can still expand into a full post
// (it already is one) per the spec's "optionally expand into a full blog
// post" requirement.
import { useEffect, useState } from 'react'
import { Rocket } from 'lucide-react'
import { fetchPostsBySeries } from './api'
import SeriesTimeline from './SeriesTimeline'
import type { BlogPost } from '../../shared/types'

const UPDATE_LOG_SERIES = 'update-log'

export default function UpdateLog() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchPostsBySeries(UPDATE_LOG_SERIES)
      .then(rows => { if (active) { setPosts(rows); setError(null) } })
      .catch((err: Error) => { if (active) setError(err.message || 'Could not load the update log.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  return (
    <SeriesTimeline
      icon={Rocket}
      title="Update Log"
      subtitle="Every Chillverse release, in one place"
      posts={posts}
      loading={loading}
      error={error}
      emptyText="No releases logged yet — check back after the next update."
    />
  )
}
