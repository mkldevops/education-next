'use client'

import { useMenu } from '@peaklab/ui'
import { MoreHorizontal, UserPlus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type CSSProperties, useEffect, useState } from 'react'
import { DeactivateStudentButton } from './deactivate-student-button'
import { EditStudentDialog } from './edit-student-dialog'
import type { StudentRow } from './students-data-table'

type Props = { student: StudentRow; canEnroll: boolean; onEnroll: () => void }
const MENU_WIDTH = 224

export function StudentActionsMenu({ student, canEnroll, onEnroll }: Props) {
  const t = useTranslations('dashboard.pages.students')
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
        className={`fixed z-40 flex w-56 flex-col gap-1 rounded border border-alabaster-700 bg-white p-1 text-left shadow-lg [&_button]:w-full [&_button]:justify-start [&_button]:border-0 [&_button]:shadow-none ${open ? '' : 'hidden'}`}
      >
        <EditStudentDialog student={student} triggerRole="menuitem" restoreFocusRef={triggerRef} />
        {canEnroll && (
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close(false)
              onEnroll()
            }}
            className="flex items-center gap-2 rounded px-3 py-2 text-sm text-primary hover:bg-alabaster-900"
          >
            <UserPlus className="h-4 w-4" />
            {t('enroll')}
          </button>
        )}
        <DeactivateStudentButton
          studentId={student.id}
          triggerRole="menuitem"
          restoreFocusRef={triggerRef}
        />
      </div>
    </div>
  )
}
