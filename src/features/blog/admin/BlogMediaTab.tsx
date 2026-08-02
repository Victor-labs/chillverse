// src/features/blog/admin/BlogMediaTab.tsx
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { Search, UploadCloud, Trash2, Copy, Loader2, ImageOff } from 'lucide-react'
import { ripple } from '../../../shared/lib/ripple'
import { fetchMediaLibrary, uploadToMediaLibrary, deleteMediaItem } from '../api'
import type { BlogMediaItem } from '../../../shared/types'
import { inputStyle } from './styles'

function formatBytes(n: number | null): string {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export default function BlogMediaTab({ currentUserId, canDeleteAny }: { currentUserId: string | null; canDeleteAny: boolean }) {
  const [items, setItems] = useState<BlogMediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function load() {
    setLoading(true)
    fetchMediaLibrary()
      .then(rows => { setItems(rows); setError(null) })
      .catch((err: Error) => setError(err.message || 'Could not load the media library.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const visible = useMemo(() => {
    if (!search.trim()) return items
    const q = search.trim().toLowerCase()
    return items.filter(i => i.filename.toLowerCase().includes(q))
  }, [items, search])

  async function handleFiles(files: FileList | null) {
    if (!files || !currentUserId) return
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (imageFiles.length === 0) { setUploadError('Only image files can be uploaded.'); return }
    setUploading(true)
    setUploadError(null)
    try {
      for (const file of imageFiles) {
        const item = await uploadToMediaLibrary(currentUserId, file)
        setItems(prev => [item, ...prev])
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  async function handleDelete(item: BlogMediaItem) {
    if (!window.confirm(`Delete "${item.filename}"? Articles already using this image will show a broken image.`)) return
    try {
      await deleteMediaItem(item)
      setItems(prev => prev.filter(i => i.id !== item.id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not delete this file.')
    }
  }

  function copyUrl(url: string) {
    navigator.clipboard?.writeText(url).catch(() => {})
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-dim)', fontSize: 13.5 }}>Loading…</div>

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 14,
          padding: '26px 16px', textAlign: 'center', cursor: 'pointer', marginBottom: 16,
          background: dragOver ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'var(--surface)',
          transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        {uploading ? <Loader2 size={20} className="animate-spin" style={{ margin: '0 auto 8px', color: 'var(--accent)' }} /> : <UploadCloud size={20} style={{ margin: '0 auto 8px', color: 'var(--text-dim)' }} />}
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          {uploading ? 'Uploading…' : 'Drag images here or tap to upload'}
        </p>
        <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '4px 0 0' }}>PNG, JPG, GIF, or WEBP — up to 5MB each</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
          style={{ display: 'none' }}
        />
      </div>

      {uploadError && <p style={{ fontSize: 12, color: '#ff8080', marginBottom: 12 }}>{uploadError}</p>}
      {error && <p style={{ fontSize: 12, color: '#ff8080', marginBottom: 12 }}>{error}</p>}

      <div style={{ position: 'relative', marginBottom: 14 }}>
        <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search filenames…" style={{ ...inputStyle, paddingLeft: 32 }} />
      </div>

      {visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
          <ImageOff size={22} style={{ margin: '0 auto 8px' }} />
          <p style={{ fontSize: 13 }}>No images yet.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
          {visible.map(item => (
            <div key={item.id} style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <img src={item.url} alt={item.filename} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
              <div style={{ padding: '7px 8px' }}>
                <p style={{ fontSize: 10.5, color: 'var(--text-dim)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.filename}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>{formatBytes(item.size_bytes)}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button" title="Copy URL"
                      onClick={(e) => { ripple(e); copyUrl(item.url) }}
                      className="ripple-wrap"
                      style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
                    >
                      <Copy size={11} />
                    </button>
                    {(canDeleteAny || item.uploaded_by === currentUserId) && (
                      <button
                        type="button" title="Delete"
                        onClick={(e) => { ripple(e); handleDelete(item) }}
                        className="ripple-wrap"
                        style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: '#ff8080', cursor: 'pointer' }}
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
