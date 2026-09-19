'use client'

import { useMenu } from '@peaklab/ui'
import { Archive, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type CSSProperties, useEffect, useState } from 'react'
import { Link } from '@/i18n/routing'
import { familyActionHref } from '../[id]/_lib/family-action-href'

type Props = { familyId: string }
const MENU_WIDTH = 224

export function FamilyActionsMenu({ familyId }: Props) {
  const t = useTranslations('dashboard.pages.families')
  const { open, close, toggle, containerRef, triggerRef, menuRef } = useMenu()
  const [anchor, setAnchor] = useState<CSSProperties>()

  useEffect(() => {
    if (!open) return
    const dismiss = () => close(false)
    window.addEventListener('scroll', dismiss, true)
    window.addEventListener('resize', dismiss)
    return () => {
      window.removeEventListener('scroll', dismiss, true)
      window.removeEventListener('resize', dismiss)
    }
  }, [open, close])

  const onTriggerClick = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setAnchor({ top: rect.bottom + 4, left: Math.max(8, rect.right - MENU_WIDTH) })
    toggle()
  }

  const item = 'flex items-center gap-2 rounded px-3 py-2 text-sm hover:bg-alabaster-900'
  return (
    <div className="relative z-10 flex justify-end" ref={containerRef}>
      <button
        type="button"
        ref={triggerRef}
        onClick={onTriggerClick}
        aria-label={t('actions')}
        aria-expanded={open}
        aria-haspopup="menu"
        className="rounded p-1 text-graphite-600 hover:bg-alabaster-800 hover:text-graphite"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      <div
        ref={menuRef}
        role="menu"
        style={anchor}
        className={`fixed z-40 flex w-56 flex-col gap-1 rounded border border-alabaster-700 bg-white p-1 text-left shadow-lg ${open ? '' : 'hidden'}`}
      >
        <Link
          role="menuitem"
          href={familyActionHref(familyId, 'editFamily')}
          className={`${item} text-graphite`}
        >
          <Pencil className="h-4 w-4" />
          {t('edit.title')}
        </Link>
        <Link
          role="menuitem"
          href={familyActionHref(familyId, 'archiveFamily')}
          className={`${item} text-graphite`}
        >
          <Archive className="h-4 w-4" />
          {t('deactivate.title')}
        </Link>
        <Link
          role="menuitem"
          href={familyActionHref(familyId, 'deleteFamily')}
          className={`${item} text-red-600`}
        >
          <Trash2 className="h-4 w-4" />
          {t('delete.title')}
        </Link>
      </div>
    </div>
  )
}
