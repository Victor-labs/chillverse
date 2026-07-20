// src/features/blog/BlogSeriesPage.tsx
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Layers } from 'lucide-react'
import { fetchPostsBySeries } from './api'
import { getSeriesLabel } from './constants'
import SeriesTimeline from './SeriesTimeline'
import type { BlogPost } from '../../shared/types'

export default function BlogSeriesPage() {
  const { series } = useParams<{ series: string }>()
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!series) return
    let active = true
    setLoading(true)
    fetchPostsBySeries(series)
      .then(rows => { if (active) { setPosts(rows); setError(null) } })
      .catch((err: Error) => { if (active) setError(err.message || 'Could not load this series.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [series])

  return (
    <SeriesTimeline
      icon={Layers}
      title={series ? getSeriesLabel(series) : 'Series'}
      subtitle={`${posts.length} post${posts.length === 1 ? '' : 's'} in this series`}
      posts={posts}
      loading={loading}
      error={error}
      emptyText="No posts in this series yet."
    />
  )
}
