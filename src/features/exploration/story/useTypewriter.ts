// src/features/exploration/story/useTypewriter.ts
//
// Reveals `lines` one character at a time, one line after another.
// - skipLine(): instantly completes the line currently being typed
// - next(): advances to the next line (only valid once the current one is done)
// Resets automatically whenever the `lines` array reference changes.

import { useEffect, useRef, useState } from 'react'

export function useTypewriter(lines: string[], speedMs = 18) {
  const [lineIndex, setLineIndex] = useState(0)
  const [displayed, setDisplayed] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    setLineIndex(0)
    setDisplayed('')
  }, [lines])

  useEffect(() => {
    const full = lines[lineIndex] ?? ''
    if (displayed.length >= full.length) return
    timerRef.current = setTimeout(() => {
      setDisplayed(full.slice(0, displayed.length + 1))
    }, speedMs)
    return () => clearTimeout(timerRef.current)
  }, [displayed, lineIndex, lines, speedMs])

  const full = lines[lineIndex] ?? ''
  const lineDone = displayed.length >= full.length
  const isLastLine = lineIndex >= lines.length - 1
  const isFinished = isLastLine && lineDone

  function skipLine() {
    setDisplayed(lines[lineIndex] ?? '')
  }

  function next() {
    if (lineIndex < lines.length - 1) {
      setLineIndex(i => i + 1)
      setDisplayed('')
    }
  }

  return { displayed, lineDone, isFinished, skipLine, next }
}
