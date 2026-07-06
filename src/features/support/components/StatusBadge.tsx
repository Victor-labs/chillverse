// src/features/support/components/StatusBadge.tsx

interface StatusBadgeProps {
  label: string
  color: string
}

export default function StatusBadge({ label, color }: StatusBadgeProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.3,
        color,
        background: `${color}1a`,
        border: `1px solid ${color}40`,
        borderRadius: 999,
        padding: '4px 10px',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {label}
    </span>
  )
}
