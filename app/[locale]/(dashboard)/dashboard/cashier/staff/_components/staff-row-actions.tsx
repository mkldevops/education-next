'use client'

import { useMenu } from '@peaklab/ui'
import { MoreHorizontal } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type CSSProperties, useEffect, useState } from 'react'
import { Link } from '@/i18n/routing'
import { MealDialog } from '../../../students/[id]/_components/meal-dialogs'
import { StaffExemptDialog } from './staff-exempt-dialog'

type Props = {
  member: { id: string; mealExempt: boolean; weekdays: number[] }
  allowedWeekdays: number[]
  canteenEnabled: boolean
  today: string
  isAdmin: boolean
}

const MENU_WIDTH = 224

/** Actions secondaires d'une ligne du personnel : jours, arrêt, fiche, exonération. */
export function StaffRowActions({
  member,
  allowedWeekdays,
  canteenEnabled,
  today,
  isAdmin,
}: Props) {
  const t = useTranslations('dashboard.pages.cashier.staff')
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

  const subscribed = member.weekdays.length > 0
  const dialog = {
    owner: { teacherId: member.id },
    service: 'CANTEEN' as const,
    allowedWeekdays,
    weekdays: member.weekdays,
    today,
    period: null,
    triggerRole: 'menuitem' as const,
    restoreFocusRef: triggerRef,
    triggerVariant: 'ghost' as const,
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
        className={`fixed z-40 flex w-56 flex-col gap-1 rounded border border-alabaster-700 bg-white p-1 text-left shadow-lg [&_a]:rounded [&_a]:px-3 [&_a]:py-1.5 [&_a]:text-sm [&_a]:text-graphite [&_a:hover]:bg-alabaster-800 [&_button]:w-full [&_button]:justify-start [&_button]:border-0 [&_button]:shadow-none ${
          open ? '' : 'hidden'
        }`}
      >
        {subscribed && canteenEnabled && <MealDialog kind="change" {...dialog} />}
        <Link href={`/dashboard/cashier/staff/${member.id}`} role="menuitem">
          {t('openSheet')}
        </Link>
        {isAdmin && (
          <StaffExemptDialog member={member} triggerRole="menuitem" restoreFocusRef={triggerRef} />
        )}
        {subscribed && <MealDialog kind="stop" {...dialog} />}
      </div>
    </div>
  )
}
