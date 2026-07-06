// src/features/support/components/SupportSearchBar.tsx
import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'

interface SupportSearchBarProps {
  initialValue?: string
  placeholder?: string
  onSearch: (query: string) => void
  autoFocus?: boolean
}

/** Debounces keystrokes by 300ms before calling onSearch, and fires immediately on Enter. */
export default function SupportSearchBar({
  initialValue = '',
  placeholder = 'Search for help…',
  onSearch,
  autoFocus = false,
}: SupportSearchBarProps) {
  const [value, setValue] = useState(initialValue)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  function handleChange(next: string) {
    setValue(next)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => onSearch(next), 300)
  }

  function handleClear() {
    setValue('')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    onSearch('')
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'var(--surface)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 'var(--radius)',
        padding: '14px 18px',
        boxShadow: '3px 3px 9px var(--neu-dark), -2px -2px 7px var(--neu-light)',
      }}
    >
      <Search size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
      <input
        type="text"
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={e => handleChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            if (debounceRef.current) clearTimeout(debounceRef.current)
            onSearch(value)
          }
        }}
        style={{
          flex: 1,
          minWidth: 0,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: 'var(--text)',
          fontSize: 14,
          fontWeight: 500,
        }}
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)',
          }}
          aria-label="Clear search"
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}
