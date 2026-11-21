'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const MENU_ITEM_SELECTOR = '[role="menuitem"]:not(:disabled)'
const NAVIGATION_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Home', 'End'])

function isEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

function nextIndex(key: string, current: number, count: number) {
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  if (key === 'ArrowDown') return current < count - 1 ? current + 1 : 0
  return current > 0 ? current - 1 : count - 1
}

export function useMenu() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const close = useCallback((restoreFocus = true) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])

  const toggle = useCallback(() => setOpen((value) => !value), [])

  useEffect(() => {
    if (!open) return

    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) close(false)
    }

    const handleFocusIn = (e: FocusEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) close(false)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close()
        return
      }
      if (!NAVIGATION_KEYS.has(e.key) || isEditable(e.target)) return

      const items = Array.from(
        menuRef.current?.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR) ?? []
      )
      if (items.length === 0) return

      e.preventDefault()
      items[
        nextIndex(e.key, items.indexOf(document.activeElement as HTMLElement), items.length)
      ].focus()
    }

    document.addEventListener('mousedown', handleClick)
    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, close])

  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector<HTMLElement>(MENU_ITEM_SELECTOR)?.focus()
  }, [open])

  return { open, close, toggle, containerRef, triggerRef, menuRef }
}
