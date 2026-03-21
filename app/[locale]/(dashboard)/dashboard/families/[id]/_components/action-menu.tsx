'use client'

import { Button } from '@peaklab/ui'
import { CreditCard, GraduationCap, Plus, UserPlus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'

type Props = {
  familyId: string
}

const actions = [
  { key: 'addChild', icon: UserPlus },
  { key: 'addEnrollment', icon: GraduationCap },
  { key: 'addPayment', icon: CreditCard },
] as const

export function ActionMenu({ familyId: _familyId }: Props) {
  const t = useTranslations('dashboard.pages.familyDetails.actions')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => {
    setOpen(false)
    const trigger = ref.current?.querySelector<HTMLButtonElement>('button[aria-haspopup]')
    trigger?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        close()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, close])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close()
        return
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
        if (!items || items.length === 0) return
        const focused = document.activeElement
        const currentIndex = Array.from(items).indexOf(focused as HTMLButtonElement)
        const next =
          e.key === 'ArrowDown'
            ? currentIndex < items.length - 1
              ? currentIndex + 1
              : 0
            : currentIndex > 0
              ? currentIndex - 1
              : items.length - 1
        items[next].focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, close])

  useEffect(() => {
    if (open) {
      const firstItem = menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')
      firstItem?.focus()
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <Button size="sm" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Plus className="mr-1.5 h-4 w-4" />
        {t('new')}
      </Button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {actions.map(({ key, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="menuitem"
              onClick={() => close()}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Icon className="h-4 w-4 text-gray-400" />
              {t(key)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
