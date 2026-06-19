// src/pages/Dashboard.tsx
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  Gamepad2,
  ShoppingBag,
  BarChart3,
  Trophy,
  Users,
  Swords,
  Puzzle,
  Brain,
  Car,
  Shield,
  MessageCircle,
  Bot,
  Send,
  Flame,
} from 'lucide-react'
import { useProfile } from '../hooks/useProfile'
import { getXpProgress } from '../lib/level'
import { ripple } from '../lib/ripple'
import { getAvatarIcon } from '../lib/icons'

// TODO: replace with real unread / live counts once the relevant backends exist
const MALL_NEW_ITEMS = 3
const CHAT_UNREAD_COUNT = 5
const LIVE_PLAYERS_ONLINE = 482

interface QuickAction {
  label: string
  to: string
  icon: LucideIcon
  tint: string
  badge?: number
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Play Now', to: '/coming-soon?feature=Play%20Now', icon: Gamepad2, tint: 'glow-violet-tint' },
  { label: 'Mall', to: '/coming-soon?feature=Mall', icon: ShoppingBag, tint: 'glow-orange-tint', badge: MALL_NEW_ITEMS },
  { label: 'Leaderboard', to: '/coming-soon?feature=Leaderboard', icon: BarChart3, tint: 'glow-pink-tint' },
  { label: 'Achievements', to: '/coming-soon?feature=Achievements', icon: Trophy, tint: 'glow-green-tint' },
]

interface FeatureTile {
  label: string
  desc: string
  to: string
  icon: LucideIcon
  tint: string
}

const FEATURE_TILES: FeatureTile[] = [
  { label: 'Arcade', desc: 'Quick-fire mini games', to: '/coming-soon?feature=Arcade', icon: Gamepad2, tint: 'glow-violet-tint' },
  { label: 'Battle Royale', desc: 'Last one standing wins', to: '/coming-soon?feature=Battle%20Royale', icon: Swords, tint: 'glow-orange-tint' },
  { label: 'Puzzle Rush', desc: 'Race the clock, not the crowd', to: '/coming-soon?feature=Puzzle%20Rush', icon: Puzzle, tint: 'glow-pink-tint' },
  { label: 'Trivia Night', desc: 'Weekly live trivia rooms', to: '/coming-soon?feature=Trivia%20Night', icon: Brain, tint: 'glow-cyan-tint' },
  { label: 'Racing Rush', desc: 'Drift, boost, repeat', to: '/coming-soon?feature=Racing%20Rush', icon: Car, tint: 'glow-green-tint' },
  { label: 'Strategy Wars', desc: 'Outsmart your squad', to: '/coming-soon?feature=Strategy%20Wars', icon: Shield, tint: 'glow-violet-tint' },
]

interface ChatPreviewRow {
  name: string
  message: string
  time: string
}

const CHAT_PREVIEW_ROWS: ChatPreviewRow[] = [
  { name: 'FluxGamer', message: 'gg that was close 🔥', time: '2m' },
  { name: 'Ayomide_', message: 'add me for squad later?', time: '14m' },
  { name: 'ZeroRush', message: 'lol nice clutch on that last round', time: '1h' },
]

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function SectionLabel({ children }: { children: string }) {
  return <p className="font-mono text-xs tracking-wider text-chill-textMuted uppercase mb-3">{children}</p>
}

export default function Dashboard() {
  const { profile, loading, error } = useProfile()

  if (loading) {
    return (
      <div className="glass-panel glow-violet-tint rounded-[22px] p-10 flex items-center justify-center">
        <span className="block w-9 h-9 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="glass-panel rounded-[22px] p-8 text-center text-chill-textSecondary">
        Couldn't load your profile right now. Try refreshing the page.
      </div>
    )
  }

  const displayName = profile.display_name || profile.username
  const { current, max } = getXpProgress(profile.xp)
  const xpPct = Math.min(100, Math.round((current / max) * 100))
  const AvatarIcon = getAvatarIcon(profile.avatar)

  return (
    <div className="flex flex-col gap-8 max-w-[1100px]">
      {/* Welcome card + XP bar */}
      <section className="glass-panel glow-violet-tint rounded-[22px] p-7 md:p-9">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="w-[54px] h-[54px] flex-shrink-0 rounded-2xl bg-gradient-to-br from-chill-violet to-chill-cyan flex items-center justify-center">
            <AvatarIcon className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              {getGreeting()}, {displayName} 👋
            </h1>
            <p className="text-sm text-chill-textSecondary mt-0.5 flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-chill-amber" />
              {profile.streak} day streak — keep it going
            </p>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-chill-text">Level {profile.level}</span>
            <span className="font-mono text-chill-textSecondary">
              {current}/{max} XP
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-chill-violet to-chill-cyan transition-all duration-500"
              style={{ width: `${xpPct}%` }}
            />
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section>
        <SectionLabel>// quick actions</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon
            return (
              <Link
                key={action.label}
                to={action.to}
                onClick={(e) => ripple(e)}
                className={`glass-panel ${action.tint} relative overflow-hidden rounded-2xl p-5 flex flex-col items-center gap-2.5 text-center transition-all duration-300 hover:-translate-y-1`}
              >
                {action.badge !== undefined && (
                  <span className="absolute top-3 right-3 text-[11px] font-bold w-5 h-5 rounded-full bg-chill-pink/20 text-chill-pink flex items-center justify-center">
                    {action.badge}
                  </span>
                )}
                <div className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center">
                  <Icon size={20} />
                </div>
                <span className="text-sm font-semibold">{action.label}</span>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Multiplayer */}
      <section>
        <SectionLabel>// multiplayer</SectionLabel>
        <Link
          to="/coming-soon?feature=Join%20Session"
          onClick={(e) => ripple(e)}
          className="glass-panel glow-green-tint relative overflow-hidden rounded-[22px] p-7 flex items-center justify-between gap-6 flex-wrap transition-all duration-300 hover:-translate-y-1"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-chill-green/15 flex items-center justify-center">
              <Users size={22} className="text-chill-green" />
            </div>
            <div>
              <h2 className="text-base font-bold">Live sessions are open</h2>
              <p className="text-sm text-chill-textSecondary mt-0.5">
                <span className="text-chill-green font-semibold">{LIVE_PLAYERS_ONLINE} players</span> online
                right now
              </p>
            </div>
          </div>
          <span className="px-5 py-2.5 rounded-full text-sm font-semibold text-chill-bg bg-chill-green flex items-center gap-2 flex-shrink-0">
            <Swords size={16} /> Join Session
          </span>
        </Link>
      </section>

      {/* Features grid */}
      <section>
        <SectionLabel>// explore chillverse</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURE_TILES.map((tile) => {
            const Icon = tile.icon
            return (
              <Link
                key={tile.label}
                to={tile.to}
                onClick={(e) => ripple(e)}
                className={`glass-panel ${tile.tint} relative overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1`}
              >
                <div className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center mb-4">
                  <Icon size={20} />
                </div>
                <h3 className="text-base font-bold mb-1">{tile.label}</h3>
                <p className="text-sm text-chill-textSecondary">{tile.desc}</p>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Chat preview */}
      <section>
        <SectionLabel>// recent chats</SectionLabel>
        <div className="glass-panel glow-cyan-tint relative overflow-hidden rounded-[22px] p-6 md:p-7">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <MessageCircle size={18} className="text-chill-cyan" />
              <h2 className="text-base font-bold">Chat</h2>
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-chill-cyan/20 text-chill-cyan">
                {CHAT_UNREAD_COUNT} new
              </span>
            </div>
            <Link
              to="/coming-soon?feature=Chat"
              onClick={(e) => ripple(e)}
              className="text-xs font-semibold text-chill-cyan hover:text-chill-text transition-colors"
            >
              Open Chat
            </Link>
          </div>

          <div className="flex flex-col gap-1">
            {CHAT_PREVIEW_ROWS.map((row) => (
              <Link
                key={row.name}
                to="/coming-soon?feature=Chat"
                onClick={(e) => ripple(e)}
                className="relative overflow-hidden flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-all"
              >
                <div className="w-9 h-9 rounded-full bg-chill-violet/20 flex items-center justify-center text-xs font-bold text-chill-violetSoft flex-shrink-0">
                  {row.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{row.name}</p>
                  <p className="text-xs text-chill-textSecondary truncate">{row.message}</p>
                </div>
                <span className="text-[11px] text-chill-textMuted flex-shrink-0">{row.time}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Halo AI teaser */}
      <section className="pb-2">
        <SectionLabel>// halo ai</SectionLabel>
        <Link
          to="/coming-soon?feature=Halo%20AI"
          onClick={(e) => ripple(e)}
          className="glass-panel glow-pink-tint relative overflow-hidden rounded-[22px] p-6 md:p-7 flex items-center gap-5 flex-wrap transition-all duration-300 hover:-translate-y-1"
        >
          <div className="w-12 h-12 rounded-xl bg-chill-pink/15 flex items-center justify-center flex-shrink-0">
            <Bot size={22} className="text-chill-pink" />
          </div>
          <div className="flex-1 min-w-[180px]">
            <h2 className="text-base font-bold">Halo AI</h2>
            <p className="text-sm text-chill-textSecondary mt-0.5">Your personal game coach — ask anything</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto flex-1 sm:flex-initial min-w-[220px]">
            <input
              type="text"
              disabled
              placeholder="Ask Halo anything..."
              className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2.5 text-sm text-chill-textSecondary placeholder:text-chill-textMuted cursor-pointer"
            />
            <span className="w-10 h-10 rounded-full bg-chill-pink/20 flex items-center justify-center flex-shrink-0">
              <Send size={16} className="text-chill-pink" />
            </span>
          </div>
        </Link>
      </section>
    </div>
  )
}
