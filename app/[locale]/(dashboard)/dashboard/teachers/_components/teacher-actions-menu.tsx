'use client'

import { useMenu } from '@peaklab/ui'
import { MoreHorizontal } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type CSSProperties, useEffect, useState } from 'react'
import { ArchiveTeacherDialog } from './archive-teacher-dialog'
import { DeleteTeacherDialog } from './delete-teacher-dialog'
import { EditTeacherDialog } from './edit-teacher-dialog'
import { InviteTeacherButton } from './invite-teacher-button'

interface Props {
  teacher: {
    id: string
    firstName: string
    lastName: string
    email: string | null
    phone: string | null
    userId: string | null
  }
  invitationPending: boolean
}

const MENU_WIDTH = 224

export function TeacherActionsMenu({ teacher, invitationPending }: Props) {
  const t = useTranslations('dashboard.pages.teachers')
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
      setAnchor({ top: rect.bottom + 4, left: Math.max(8, rect.right - MENU_WIDTH) })
    }
    toggle()
  }

  const teacherName = `${teacher.lastName} ${teacher.firstName}`

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
        className={`fixed z-40 flex w-56 flex-col gap-1 rounded border border-alabaster-700 bg-white p-1 text-left shadow-lg [&_button]:w-full [&_button]:justify-start [&_button]:border-0 [&_button]:shadow-none ${
          open ? '' : 'hidden'
        }`}
      >
        {!teacher.userId && (
          <InviteTeacherButton
            teacherId={teacher.id}
            hasEmail={Boolean(teacher.email)}
            pending={invitationPending}
            triggerRole="menuitem"
          />
        )}
        <EditTeacherDialog teacher={teacher} triggerRole="menuitem" restoreFocusRef={triggerRef} />
        <ArchiveTeacherDialog
          teacherId={teacher.id}
          teacherName={teacherName}
          triggerRole="menuitem"
          restoreFocusRef={triggerRef}
        />
        <DeleteTeacherDialog
          teacherId={teacher.id}
          teacherName={teacherName}
          triggerRole="menuitem"
          restoreFocusRef={triggerRef}
        />
      </div>
    </div>
  )
}
