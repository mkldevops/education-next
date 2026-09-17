'use client'

import { useMenu } from '@peaklab/ui'
import { MoreHorizontal } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type CSSProperties, useEffect, useState } from 'react'
import { DeleteClassDialog } from './delete-class-dialog'
import { EditClassDialog } from './edit-class-dialog'

type Option = { id: string; name: string }

interface ClassActionsMenuProps {
  classItem: {
    id: string
    name: string
    capacity: number
    levelId: string
    teacherIds: string[]
  }
  levels: Option[]
  teachers: Option[]
}

const MENU_WIDTH = 224

/** Keeps row actions compact and positions the menu outside DataTable's overflow container. */
export function ClassActionsMenu({ classItem, levels, teachers }: ClassActionsMenuProps) {
  const t = useTranslations('dashboard.pages.classes')
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
    if (rect) {
      setAnchor({
        top: rect.bottom + 4,
        left: Math.max(8, rect.right - MENU_WIDTH),
      })
    }
    toggle()
  }

  return (
    <div className="relative flex justify-end" ref={containerRef}>
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
        className={`fixed z-40 flex w-56 flex-col gap-1 rounded border border-alabaster-700 bg-white p-1 text-left shadow-lg [&_button]:w-full [&_button]:justify-start [&_button]:border-0 [&_button]:shadow-none ${
          open ? '' : 'hidden'
        }`}
      >
        <EditClassDialog
          classItem={classItem}
          levels={levels}
          teachers={teachers}
          triggerRole="menuitem"
          restoreFocusRef={triggerRef}
        />
        <DeleteClassDialog
          classPeriodId={classItem.id}
          className={classItem.name}
          triggerRole="menuitem"
          restoreFocusRef={triggerRef}
        />
      </div>
    </div>
  )
}
