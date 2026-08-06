// src/features/support/constants.ts
import type { LucideIcon } from 'lucide-react'
import {
  Rocket, UserCircle, Gamepad2, Gem, Users, CreditCard, ShieldCheck,
  HelpCircle, Users2, MessageCircle, Crown, Trophy, Newspaper, Bell,
  Gift, Search, Settings,
} from 'lucide-react'
import type { SupportTicketPriority, SupportTicketStatus } from '../../shared/types'

/** Maps the `icon` string stored on a support_categories row to a Lucide icon. */
export const SUPPORT_CATEGORY_ICONS: Record<string, LucideIcon> = {
  Rocket,
  UserCircle,
  Gamepad2,
  Gem,
  Users,
  CreditCard,
  ShieldCheck,
  HelpCircle,
  Users2,
  MessageCircle,
  Crown,
  Trophy,
  Newspaper,
  Bell,
  Gift,
  Search,
  Settings,
}

export function getSupportCategoryIcon(icon: string): LucideIcon {
  return SUPPORT_CATEGORY_ICONS[icon] ?? HelpCircle
}

export const SUPPORT_TICKET_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

export const SUPPORT_TICKET_STATUS_COLORS: Record<SupportTicketStatus, string> = {
  open: 'var(--blue)',
  in_progress: 'var(--gold)',
  resolved: 'var(--green)',
  closed: 'var(--text-muted)',
}

export const SUPPORT_TICKET_PRIORITY_LABELS: Record<SupportTicketPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
}

export const SUPPORT_TICKET_PRIORITY_COLORS: Record<SupportTicketPriority, string> = {
  low: 'var(--text-dim)',
  normal: 'var(--blue)',
  high: 'var(--gold)',
  urgent: 'var(--red)',
}
