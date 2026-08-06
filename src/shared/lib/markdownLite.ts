// src/shared/lib/markdownLite.ts
// A tiny, dependency-free markdown subset for blog post content: headings
// (## / ###), bullet + numbered lists, blockquotes, links, bold, and italic.
// Deliberately NOT a full markdown/HTML pipeline — content stays plain text
// in the database (paragraphs separated by a blank line, same convention as
// support_articles), so existing seed posts with no markdown syntax in them
// still render exactly as before: this only adds *optional* formatting on
// top of that convention, it doesn't replace it.
import { createElement, type ReactNode } from 'react'
import {
  Info, AlertTriangle, CheckCircle2, Lightbulb, HelpCircle, Star, Sparkles,
  ShieldCheck, Bell, Flame, Zap, XCircle, BookOpen, type LucideIcon,
} from 'lucide-react'

const INLINE_TOKEN = /(\*\*.+?\*\*|\*.+?\*|`.+?`|\[.+?\]\(.+?\))/g

function parseInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(INLINE_TOKEN).filter(p => p !== '')
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`
    const boldMatch = /^\*\*(.+)\*\*$/.exec(part)
    if (boldMatch) return createElement('strong', { key }, boldMatch[1])
    const italicMatch = /^\*(.+)\*$/.exec(part)
    if (italicMatch) return createElement('em', { key }, italicMatch[1])
    const codeMatch = /^`(.+)`$/.exec(part)
    if (codeMatch) return createElement('code', { key, style: INLINE_CODE_STYLE }, codeMatch[1])
    const linkMatch = /^\[(.+)\]\((.+)\)$/.exec(part)
    if (linkMatch) {
      return createElement(
        'a',
        { key, href: linkMatch[2], target: '_blank', rel: 'noopener noreferrer', style: { color: 'var(--accent)', textDecoration: 'underline' } },
        linkMatch[1]
      )
    }
    return part
  })
}

const INLINE_CODE_STYLE: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: '0.9em',
  background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px',
}

// ── Callout ("highlight") blocks ──────────────────────────────────────
// Syntax, written by the editor's highlight picker:
//
//   {{callout:blue:Info}}
//   The highlighted text, which may run over several lines.
//
// A blank line closes it, same as every other block, so the existing
// splitter needs no special case. Colour and icon are both stored as
// plain names rather than raw hex/SVG, so a callout written today still
// re-themes correctly when the palette changes.

export const CALLOUT_COLORS: { id: string; label: string; cssVar: string }[] = [
  { id: 'blue',    label: 'Info',    cssVar: 'var(--blue)' },
  { id: 'green',   label: 'Success', cssVar: 'var(--green)' },
  { id: 'gold',    label: 'Warning', cssVar: 'var(--gold)' },
  { id: 'red',     label: 'Danger',  cssVar: 'var(--red)' },
  { id: 'purple',  label: 'Note',    cssVar: 'var(--purple)' },
  { id: 'pink',    label: 'Accent',  cssVar: 'var(--pink)' },
  { id: 'brand',   label: 'Brand',   cssVar: 'var(--accent)' },
  { id: 'neutral', label: 'Neutral', cssVar: 'var(--text-dim)' },
]

export const CALLOUT_ICONS: Record<string, LucideIcon> = {
  Info, AlertTriangle, CheckCircle2, Lightbulb, HelpCircle, Star, Sparkles,
  ShieldCheck, Bell, Flame, Zap, XCircle, BookOpen,
}

export const CALLOUT_ICON_NAMES = Object.keys(CALLOUT_ICONS)

export function calloutColorVar(id: string): string {
  return CALLOUT_COLORS.find(c => c.id === id)?.cssVar ?? 'var(--blue)'
}

/** Ref callback for ambient videos. The `muted` attribute alone isn't
 *  always enough for autoplay — browsers check the *property*, which React
 *  doesn't always set before the element starts loading — so this sets it
 *  directly and kicks off playback, swallowing the rejection if the browser
 *  still blocks it (the first frame then stands in as a poster). */
function primeAmbientVideo(el: HTMLVideoElement | null): void {
  if (!el) return
  el.muted = true
  el.defaultMuted = true
  el.disablePictureInPicture = true
  const started = el.play()
  if (started && typeof started.catch === 'function') {
    started.catch(() => { /* autoplay blocked — the poster frame stands in */ })
  }
}

/** Options for `renderLiteMarkdown`. */
export interface RenderOptions {
  /** Ambient media: videos autoplay muted on a loop with no player chrome
   *  (no play/pause, no scrubber, no fullscreen). Used by help articles,
   *  where a clip is an illustration of a step rather than something the
   *  reader is meant to operate. Blog posts keep normal controls. */
  ambientMedia?: boolean
}

/** Extracts an 11-char YouTube video ID from any common YouTube URL shape, or returns the input unchanged if it already looks like a bare ID. */
export function extractYouTubeId(input: string): string | null {
  const trimmed = input.trim()
  const patterns = [
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/,
  ]
  for (const re of patterns) {
    const m = re.exec(trimmed)
    if (m) return m[1]
  }
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed
  return null
}

/** Splits raw content into top-level blocks, keeping ``` code fences intact (blank lines inside a fence must not split it). */
function splitIntoRawBlocks(content: string): string[] {
  const lines = content.split('\n')
  const blocks: string[] = []
  let current: string[] = []
  let inFence = false

  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      current.push(line)
      if (inFence) {
        blocks.push(current.join('\n'))
        current = []
      }
      inFence = !inFence
      continue
    }
    if (inFence) {
      current.push(line)
      continue
    }
    if (line.trim() === '') {
      if (current.length) { blocks.push(current.join('\n')); current = [] }
      continue
    }
    current.push(line)
  }
  if (current.length) blocks.push(current.join('\n'))
  return blocks.filter(b => b.trim() !== '')
}

const YOUTUBE_BLOCK_RE = /^\{\{youtube:([\w-]{11})\}\}$/
const VIDEO_BLOCK_RE = /^\{\{video:(.+?)\}\}$/
const IMAGE_BLOCK_RE = /^!\[(.*?)\]\((.+?)\)$/
const TABLE_SEPARATOR_RE = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/
const CALLOUT_OPEN_RE = /^\{\{callout(?::([a-z]+))?(?::([A-Za-z0-9]+))?\}\}$/

/** Renders a blog post's plain-text/lite-markdown content into React nodes. Supports headings, lists, quotes, links, bold/italic/inline code, fenced code blocks, pipe tables, images, `{{youtube:ID}}` embeds, `{{video:URL}}` embeds (self-hosted uploads), and `{{callout:color:Icon}}` highlight blocks. */
export function renderLiteMarkdown(content: string, options: RenderOptions = {}): ReactNode[] {
  const blocks = splitIntoRawBlocks(content)
  const ambient = options.ambientMedia === true

  return blocks.map((block, i) => {
    const key = `block-${i}`
    const trimmedBlock = block.trim()

    // ── Fenced code block ──
    if (trimmedBlock.startsWith('```')) {
      const fenceLines = trimmedBlock.split('\n')
      const lang = fenceLines[0].replace(/^```/, '').trim()
      const code = fenceLines.slice(1, fenceLines[fenceLines.length - 1].trim() === '```' ? -1 : undefined).join('\n')
      return createElement(
        'pre', { key, style: CODE_BLOCK_STYLE },
        createElement('code', { style: { fontFamily: INLINE_CODE_STYLE.fontFamily }, 'data-lang': lang || undefined }, code)
      )
    }

    // ── YouTube embed ──
    const ytMatch = YOUTUBE_BLOCK_RE.exec(trimmedBlock)
    if (ytMatch) {
      const id = ytMatch[1]
      // Ambient: muted autoplay is the only kind browsers allow without a
      // gesture, and `loop` needs `playlist` set to the same id to work on
      // a single video. controls/fs/keyboard are all switched off.
      const src = ambient
        ? `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&modestbranding=1&rel=0&playsinline=1&disablekb=1&fs=0&iv_load_policy=3`
        : `https://www.youtube.com/embed/${id}`
      return createElement(
        'div', { key, style: ambient ? { ...YOUTUBE_WRAP_STYLE, pointerEvents: 'none' } : YOUTUBE_WRAP_STYLE },
        createElement('iframe', {
          src,
          title: 'YouTube video', allowFullScreen: !ambient, style: YOUTUBE_IFRAME_STYLE,
          tabIndex: ambient ? -1 : undefined,
          allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
        })
      )
    }

    // ── Self-hosted video embed ──
    const videoMatch = VIDEO_BLOCK_RE.exec(trimmedBlock)
    if (videoMatch) {
      if (ambient) {
        return createElement('video', {
          key, src: videoMatch[1],
          autoPlay: true, loop: true, muted: true, playsInline: true, controls: false,
          preload: 'auto',
          ref: primeAmbientVideo,
          disablePictureInPicture: true,
          controlsList: 'nodownload nofullscreen noremoteplayback',
          onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
          style: AMBIENT_VIDEO_STYLE,
        })
      }
      return createElement('video', {
        key, src: videoMatch[1], controls: true, playsInline: true, loop: true, style: VIDEO_BLOCK_STYLE,
      })
    }

    // ── Callout / highlight ──
    const calloutLines = trimmedBlock.split('\n')
    const calloutOpen = CALLOUT_OPEN_RE.exec(calloutLines[0].trim())
    if (calloutOpen) {
      const colorVar = calloutColorVar(calloutOpen[1] ?? 'blue')
      const Icon = CALLOUT_ICONS[calloutOpen[2] ?? 'Info'] ?? Info
      const body = calloutLines.slice(1).filter(l => l.trim() !== '')
      return createElement(
        'div',
        {
          key,
          style: {
            display: 'flex', gap: 12, alignItems: 'flex-start',
            margin: '0 0 18px', padding: '14px 16px', borderRadius: 14,
            background: `color-mix(in srgb, ${colorVar} 10%, transparent)`,
            border: `1px solid color-mix(in srgb, ${colorVar} 30%, transparent)`,
            borderLeft: `3px solid ${colorVar}`,
          },
        },
        createElement(Icon, { key: `${key}-icon`, size: 17, color: colorVar, style: { flexShrink: 0, marginTop: 2 } }),
        createElement(
          'div', { key: `${key}-body`, style: { flex: 1, minWidth: 0 } },
          body.map((line, j) => createElement(
            'p',
            { key: `${key}-l${j}`, style: { ...CALLOUT_TEXT_STYLE, margin: j === body.length - 1 ? 0 : '0 0 8px' } },
            parseInline(line, `${key}-l${j}`)
          ))
        )
      )
    }

    // ── Standalone image ──
    const imgMatch = IMAGE_BLOCK_RE.exec(trimmedBlock)
    if (imgMatch) {
      return createElement('img', { key, src: imgMatch[2], alt: imgMatch[1], style: IMAGE_BLOCK_STYLE })
    }

    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)

    // ── Pipe table ──
    if (lines.length >= 2 && lines[0].includes('|') && TABLE_SEPARATOR_RE.test(lines[1])) {
      const splitRow = (row: string) => row.replace(/^\||\|$/g, '').split('|').map(c => c.trim())
      const headerCells = splitRow(lines[0])
      const bodyRows = lines.slice(2).map(splitRow)
      return createElement(
        'div', { key, style: TABLE_WRAP_STYLE },
        createElement('table', { style: TABLE_STYLE },
          createElement('thead', null, createElement('tr', null,
            headerCells.map((c, j) => createElement('th', { key: j, style: TH_STYLE }, parseInline(c, `${key}-h${j}`))))),
          createElement('tbody', null, bodyRows.map((row, r) => createElement('tr', { key: r },
            row.map((c, j) => createElement('td', { key: j, style: TD_STYLE }, parseInline(c, `${key}-${r}-${j}`))))))
        )
      )
    }

    if (block.startsWith('### ')) {
      return createElement('h3', { key, style: H3_STYLE }, parseInline(block.replace(/^### /, ''), key))
    }
    if (block.startsWith('## ')) {
      return createElement('h2', { key, style: H2_STYLE }, parseInline(block.replace(/^## /, ''), key))
    }
    if (block.startsWith('> ')) {
      return createElement('blockquote', { key, style: QUOTE_STYLE }, parseInline(block.replace(/^>\s?/, ''), key))
    }
    if (lines.length > 0 && lines.every(l => /^[-*]\s/.test(l))) {
      return createElement(
        'ul', { key, style: LIST_STYLE },
        lines.map((l, j) => createElement('li', { key: `${key}-${j}`, style: LI_STYLE }, parseInline(l.replace(/^[-*]\s/, ''), `${key}-${j}`)))
      )
    }
    if (lines.length > 0 && lines.every(l => /^\d+\.\s/.test(l))) {
      return createElement(
        'ol', { key, style: LIST_STYLE },
        lines.map((l, j) => createElement('li', { key: `${key}-${j}`, style: LI_STYLE }, parseInline(l.replace(/^\d+\.\s/, ''), `${key}-${j}`)))
      )
    }
    return createElement('p', { key, style: P_STYLE }, parseInline(block, key))
  })
}

const CODE_BLOCK_STYLE: React.CSSProperties = {
  margin: '0 0 18px', padding: '14px 16px', borderRadius: 10, overflowX: 'auto',
  background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 13, lineHeight: 1.6,
}
const YOUTUBE_WRAP_STYLE: React.CSSProperties = { position: 'relative', paddingTop: '56.25%', margin: '0 0 18px', borderRadius: 12, overflow: 'hidden', background: '#000' }
const YOUTUBE_IFRAME_STYLE: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }
const IMAGE_BLOCK_STYLE: React.CSSProperties = { width: '100%', borderRadius: 12, margin: '0 0 18px', display: 'block' }
const VIDEO_BLOCK_STYLE: React.CSSProperties = { width: '100%', borderRadius: 12, margin: '0 0 18px', display: 'block', background: '#000' }
const AMBIENT_VIDEO_STYLE: React.CSSProperties = {
  width: '100%', borderRadius: 12, margin: '0 0 18px', display: 'block', background: '#000',
  // No chrome means nothing to click — swallowing pointer events also stops
  // the tap-to-pause / long-press-to-save gestures mobile browsers add.
  pointerEvents: 'none', userSelect: 'none',
}
const CALLOUT_TEXT_STYLE: React.CSSProperties = { fontSize: 14.5, lineHeight: 1.65, color: 'var(--text)', fontWeight: 600 }
const TABLE_WRAP_STYLE: React.CSSProperties = { margin: '0 0 18px', overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }
const TABLE_STYLE: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 14 }
const TH_STYLE: React.CSSProperties = { textAlign: 'left', padding: '9px 12px', background: 'var(--surface2)', color: 'var(--text)', fontWeight: 700, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const TD_STYLE: React.CSSProperties = { textAlign: 'left', padding: '9px 12px', color: 'var(--text)', borderBottom: '1px solid var(--border)' }

const P_STYLE: React.CSSProperties = { fontSize: 15, lineHeight: 1.75, color: 'var(--text)', margin: '0 0 18px' }
const H2_STYLE: React.CSSProperties = { fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: '28px 0 12px' }
const H3_STYLE: React.CSSProperties = { fontSize: 17, fontWeight: 800, color: 'var(--text)', margin: '22px 0 10px' }
const LIST_STYLE: React.CSSProperties = { margin: '0 0 18px', paddingLeft: 22 }
const LI_STYLE: React.CSSProperties = { fontSize: 15, lineHeight: 1.75, color: 'var(--text)', marginBottom: 6 }
const QUOTE_STYLE: React.CSSProperties = {
  margin: '0 0 18px', padding: '4px 0 4px 16px', borderLeft: '3px solid var(--accent)',
  fontSize: 15, lineHeight: 1.7, color: 'var(--text-dim)', fontStyle: 'italic',
}

// ── Toolbar helper — inserts/wraps markdown syntax at the textarea's cursor ──

export type MarkdownAction =
  | 'bold' | 'italic' | 'code' | 'h2' | 'h3' | 'bullet' | 'numbered' | 'quote' | 'link'
  | 'codeblock' | 'table' | 'image' | 'youtube' | 'video' | 'callout'

/** Ensures an insertion at `pos` starts on its own blank line (needed for block-level inserts like tables/code/images so they don't merge into a preceding paragraph). */
function ensureBlockGap(value: string, pos: number): { prefix: string; pos: number } {
  if (pos === 0) return { prefix: '', pos }
  const before = value.slice(0, pos)
  if (/\n\n$/.test(before) || before === '') return { prefix: '', pos }
  const needsNewline = !before.endsWith('\n')
  return { prefix: needsNewline ? '\n\n' : '\n', pos }
}

/** Given a textarea's current value + selection, returns the new value and
 *  where the cursor should land afterwards. Wraps the selection for
 *  bold/italic/link/code, prefixes each selected line for block-level text
 *  actions, and inserts a ready-to-edit template for table/code/image/YouTube. */
export function applyMarkdownAction(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  action: MarkdownAction,
  promptValue?: string | null
): { value: string; selectionStart: number; selectionEnd: number } {
  const selected = value.slice(selectionStart, selectionEnd)

  function wrap(marker: string, placeholder: string) {
    const text = selected || placeholder
    const inserted = `${marker}${text}${marker}`
    const next = value.slice(0, selectionStart) + inserted + value.slice(selectionEnd)
    return { value: next, selectionStart: selectionStart + marker.length, selectionEnd: selectionStart + marker.length + text.length }
  }

  function prefixLines(prefix: (i: number) => string, placeholder: string) {
    const text = selected || placeholder
    const lines = text.split('\n')
    const inserted = lines.map((l, i) => `${prefix(i)}${l}`).join('\n')
    const next = value.slice(0, selectionStart) + inserted + value.slice(selectionEnd)
    return { value: next, selectionStart, selectionEnd: selectionStart + inserted.length }
  }

  /** Inserts a block-level template on its own line(s), placing the cursor at `cursorOffset` within it. */
  function insertBlock(template: string, cursorOffset: number) {
    const { prefix } = ensureBlockGap(value, selectionStart)
    const inserted = `${prefix}${template}\n\n`
    const next = value.slice(0, selectionStart) + inserted + value.slice(selectionEnd)
    const cursor = selectionStart + prefix.length + cursorOffset
    return { value: next, selectionStart: cursor, selectionEnd: cursor }
  }

  switch (action) {
    case 'bold': return wrap('**', 'bold text')
    case 'italic': return wrap('*', 'italic text')
    case 'code': return wrap('`', 'code')
    case 'h2': return prefixLines(() => '## ', 'Heading')
    case 'h3': return prefixLines(() => '### ', 'Subheading')
    case 'bullet': return prefixLines(() => '- ', 'List item')
    case 'numbered': return prefixLines(i => `${i + 1}. `, 'List item')
    case 'quote': return prefixLines(() => '> ', 'Quote')
    case 'link': {
      const text = selected || 'link text'
      const inserted = `[${text}](https://)`
      const next = value.slice(0, selectionStart) + inserted + value.slice(selectionEnd)
      // Select the "https://" part so it's ready to be typed over.
      const urlStart = selectionStart + text.length + 3
      return { value: next, selectionStart: urlStart, selectionEnd: urlStart + 8 }
    }
    case 'codeblock': {
      const code = selected || 'your code here'
      return insertBlock('```\n' + code + '\n```', 4)
    }
    case 'table': {
      const template = '| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n| Cell | Cell | Cell |'
      return insertBlock(template, 2)
    }
    case 'image': {
      const url = promptValue?.trim()
      if (!url) return { value, selectionStart, selectionEnd }
      return insertBlock(`![](${url})`, 2)
    }
    case 'youtube': {
      const id = promptValue?.trim()
      if (!id) return { value, selectionStart, selectionEnd }
      const template = `{{youtube:${id}}}`
      return insertBlock(template, template.length)
    }
    case 'video': {
      const url = promptValue?.trim()
      if (!url) return { value, selectionStart, selectionEnd }
      const template = `{{video:${url}}}`
      return insertBlock(template, template.length)
    }
    case 'callout': {
      // promptValue arrives as "color:Icon" from the editor's picker.
      const [color = 'blue', icon = 'Info'] = (promptValue ?? '').split(':')
      const text = selected || 'Highlighted text'
      const template = `{{callout:${color}:${icon}}}\n${text}`
      // Land the cursor on the body line so it can be typed over directly.
      return insertBlock(template, template.length - text.length)
    }
  }
}
