// src/pages/Wallet.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, ShoppingBag, Ticket } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from '../auth/useAuth'
import { useWallet } from './useWallet'

// ─── Types ────────────────────────────────────────────────────
interface DiamondTx {
  id: string
  created_at: string
  amount: number          // positive = credit, negative = debit
  description: string
  pack_id?: string | null
}

interface SpendEntry {
  id: string
  created_at: string
  item_name: string
  item_type: 'diamond' | 'orb' | 'voucher'
  cost: number
}

// ─── Helpers ──────────────────────────────────────────────────
function fmt(n: number) { return n.toLocaleString() }
function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ─── Currency Card ────────────────────────────────────────────
function CurrencyCard({
  icon,
  label,
  amount,
  sub,
  accent,
  bg,
  border,
}: {
  icon: React.ReactNode
  label: string
  amount: string
  sub: string
  accent: string
  bg: string
  border: string
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 18,
        padding: '16px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        boxShadow: 'var(--elev-raise-sm)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ color: accent, display: 'flex', alignItems: 'center' }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.7px' }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', lineHeight: 1.1 }}>{amount}</div>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{sub}</div>
    </div>
  )
}

// ─── Orb Icon (SVG inline) ────────────────────────────────────
function OrbIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="5" fill="#34d399" opacity="0.9" />
      <circle cx="12" cy="12" r="9" stroke="#34d399" strokeWidth="1.2" opacity="0.35" fill="none" />
      <circle cx="17.5" cy="12" r="2" fill="#34d399" opacity="0.7" />
    </svg>
  )
}

// ─── Voucher Icon (SVG inline, smaller) ───────────────────────
function VoucherIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="6" width="20" height="12" rx="3" stroke="#f0c060" strokeWidth="1.5" fill="none" />
      <circle cx="7" cy="12" r="2" fill="#f0c060" opacity="0.8" />
      <line x1="11" y1="9" x2="19" y2="9" stroke="#f0c060" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
      <line x1="11" y1="12" x2="17" y2="12" stroke="#f0c060" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
    </svg>
  )
}

// ─── Transaction Row ──────────────────────────────────────────
function TxRow({
  icon,
  label,
  sub,
  amount,
  amountColor,
}: {
  icon: React.ReactNode
  label: string
  sub: string
  amount: string
  amountColor: string
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 11,
        background: 'var(--surface2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: amountColor, flexShrink: 0 }}>{amount}</div>
    </div>
  )
}

// ─── Section Header ───────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10, marginTop: 28 }}>
      {children}
    </p>
  )
}

// ─── Empty State ──────────────────────────────────────────────
function EmptyState({ label }: { label: string }) {
  return (
    <div style={{ padding: '26px 0', textAlign: 'center' }}>
      <Clock size={24} style={{ color: 'var(--text-muted)', margin: '0 auto 8px', display: 'block' }} />
      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</p>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────
export default function Wallet() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { wallet, loading: walletLoading } = useWallet()

  // Diamond transaction history
  const [diamondTxs, setDiamondTxs] = useState<DiamondTx[]>([])
  const [txLoading, setTxLoading] = useState(true)

  // Spending history (mall purchases etc.)
  const [spends, setSpends] = useState<SpendEntry[]>([])
  const [spendsLoading, setSpendsLoading] = useState(true)

  // Active tab: 'diamonds' | 'orbs' | 'vouchers'
  const [activeTab, setActiveTab] = useState<'diamonds' | 'orbs' | 'vouchers'>('diamonds')

  useEffect(() => {
    if (!user) return
    setTxLoading(true)
    ;(async () => {
      try {
        const { data } = await supabase
          .from('diamond_transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(30)
        setDiamondTxs((data as DiamondTx[]) ?? [])
      } catch {
        // table may not exist yet
      } finally {
        setTxLoading(false)
      }
    })()
  }, [user])

  useEffect(() => {
    if (!user) return
    setSpendsLoading(true)
    ;(async () => {
      try {
        const { data } = await supabase
          .from('purchase_history')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(40)
        setSpends((data as SpendEntry[]) ?? [])
      } catch {
        // table may not exist yet
      } finally {
        setSpendsLoading(false)
      }
    })()
  }, [user])

  const diamonds = wallet?.gem_balance ?? 0

  // Filter spends by currency type
  const diamondSpends = spends.filter(s => s.item_type === 'diamond')
  const orbSpends = spends.filter(s => s.item_type === 'orb')
  const voucherSpends = spends.filter(s => s.item_type === 'voucher')

  const tabs = [
    { key: 'diamonds' as const, label: '💎 Diamonds' },
    { key: 'orbs' as const, label: 'Orbs' },
    { key: 'vouchers' as const, label: 'Vouchers' },
  ]

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', paddingBottom: 56 }}>

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', marginBottom: 24, paddingTop: 4 }}>
        <button
          type="button"
          onClick={(e) => { ripple(e); navigate('/dashboard') }}
          style={{
            width: 38, height: 38, borderRadius: 11,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--elev-raise-sm)',
            color: 'var(--text-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Wallet</h1>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: 0 }}>Your currencies &amp; spending history</p>
        </div>
      </div>

      {/* ── Currency Cards ── */}
      <div style={{ padding: '0 20px', marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          {/* Diamonds */}
          <CurrencyCard
            icon={<span style={{ fontSize: 16 }}>💎</span>}
            label="Diamonds"
            amount={walletLoading ? '—' : fmt(diamonds)}
            sub="Premium currency"
            accent="#4f8ef7"
            bg="rgba(79,142,247,0.07)"
            border="rgba(79,142,247,0.2)"
          />
          {/* Orbs */}
          <CurrencyCard
            icon={<OrbIcon size={16} />}
            label="Orbs"
            amount="—"
            sub="Coming soon"
            accent="#34d399"
            bg="rgba(52,211,153,0.07)"
            border="rgba(52,211,153,0.18)"
          />
          {/* Vouchers — slightly smaller card */}
          <div
            style={{
              flex: '0 0 auto',
              width: 90,
              background: 'rgba(240,192,96,0.07)',
              border: '1px solid rgba(240,192,96,0.2)',
              borderRadius: 18,
              padding: '13px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
              boxShadow: 'var(--elev-raise-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <VoucherIcon size={13} />
              <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Vouchers</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', lineHeight: 1.1 }}>—</div>
            <div style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>Coming soon</div>
          </div>
        </div>

        {/* Buy more diamonds CTA */}
        <button
          type="button"
          onClick={(e) => { ripple(e); navigate('/buy-diamonds') }}
          className="ripple-wrap btn-primary"
          style={{ width: '100%', marginTop: 14, padding: '11px 0', borderRadius: 13, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
        >
          💎 Buy Diamonds
        </button>
      </div>

      {/* ── Tabs ── */}
      <div style={{ padding: '0 20px', marginTop: 28 }}>
        <div style={{ display: 'flex', gap: 6, background: 'var(--surface)', borderRadius: 14, padding: 4 }}>
          {tabs.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              style={{
                flex: 1, padding: '8px 4px', borderRadius: 11,
                fontSize: 11.5, fontWeight: 700,
                background: activeTab === t.key ? 'var(--surface2)' : 'transparent',
                border: activeTab === t.key ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
                color: activeTab === t.key ? 'var(--text)' : 'var(--text-muted)',
                cursor: 'pointer', transition: 'background-color var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out), opacity var(--dur-base) var(--ease-out)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── TAB: DIAMONDS ─── */}
      {activeTab === 'diamonds' && (
        <div style={{ padding: '0 20px' }}>
          <SectionLabel>Diamond Purchases</SectionLabel>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '0 16px', boxShadow: 'var(--elev-raise-sm)' }}>
            {txLoading ? (
              <div style={{ padding: '24px 0', textAlign: 'center' }}>
                <div style={{ width: 20, height: 20, border: '2px solid var(--surface3)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
              </div>
            ) : diamondTxs.filter(t => t.amount > 0).length === 0 ? (
              <EmptyState label="No diamond purchases yet" />
            ) : (
              diamondTxs.filter(t => t.amount > 0).map(tx => (
                <TxRow
                  key={tx.id}
                  icon={<span style={{ fontSize: 15 }}>💎</span>}
                  label={tx.description || 'Diamond Top-up'}
                  sub={relTime(tx.created_at)}
                  amount={`+${fmt(tx.amount)} 💎`}
                  amountColor="#3ecf8e"
                />
              ))
            )}
          </div>

          <SectionLabel>Spent on Items</SectionLabel>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '0 16px', boxShadow: 'var(--elev-raise-sm)' }}>
            {spendsLoading ? (
              <div style={{ padding: '24px 0', textAlign: 'center' }}>
                <div style={{ width: 20, height: 20, border: '2px solid var(--surface3)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
              </div>
            ) : diamondSpends.length === 0 ? (
              <EmptyState label="No spending history yet" />
            ) : (
              diamondSpends.map(s => (
                <TxRow
                  key={s.id}
                  icon={<ShoppingBag size={14} style={{ color: 'var(--text-dim)' }} />}
                  label={s.item_name}
                  sub={relTime(s.created_at)}
                  amount={`-${fmt(s.cost)} 💎`}
                  amountColor="#ff6b6b"
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* ─── TAB: ORBS ─── */}
      {activeTab === 'orbs' && (
        <div style={{ padding: '0 20px' }}>
          <SectionLabel>Orb Activity</SectionLabel>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '0 16px', boxShadow: 'var(--elev-raise-sm)' }}>
            {orbSpends.length === 0 ? (
              <div style={{ padding: '36px 0', textAlign: 'center' }}>
                <OrbIcon size={28} />
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 10, fontWeight: 600 }}>Orb currency coming soon</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Earn &amp; spend Orbs on exclusive items</p>
              </div>
            ) : (
              orbSpends.map(s => (
                <TxRow
                  key={s.id}
                  icon={<OrbIcon size={15} />}
                  label={s.item_name}
                  sub={relTime(s.created_at)}
                  amount={`-${fmt(s.cost)} Orbs`}
                  amountColor="#ff6b6b"
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* ─── TAB: VOUCHERS ─── */}
      {activeTab === 'vouchers' && (
        <div style={{ padding: '0 20px' }}>
          <SectionLabel>Voucher Activity</SectionLabel>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '0 16px', boxShadow: 'var(--elev-raise-sm)' }}>
            {voucherSpends.length === 0 ? (
              <div style={{ padding: '36px 0', textAlign: 'center' }}>
                <Ticket size={26} style={{ color: '#f0c060', margin: '0 auto', display: 'block' }} />
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 10, fontWeight: 600 }}>Vouchers coming soon</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Collect &amp; redeem voucher tickets</p>
              </div>
            ) : (
              voucherSpends.map(s => (
                <TxRow
                  key={s.id}
                  icon={<VoucherIcon size={15} />}
                  label={s.item_name}
                  sub={relTime(s.created_at)}
                  amount={`-${fmt(s.cost)} pts`}
                  amountColor="#ff6b6b"
                />
              ))
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
