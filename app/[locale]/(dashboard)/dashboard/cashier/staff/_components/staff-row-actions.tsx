'use client'

import { cn, useMenu } from '@peaklab/ui'
import { FileText, MoreHorizontal } from 'lucide-react'
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

const ITEM_CLASSES = [
  '[&_[role=menuitem][data-kind=stop]]:text-red-600 [&_[role=menuitem][data-kind=stop]_svg]:text-red-600',
  '[&_[role=menuitem][data-kind=stop]:hover]:bg-red-50',
  '[&_[role=menuitem]]:flex [&_[role=menuitem]]:h-auto [&_[role=menuitem]]:w-full',
  '[&_[role=menuitem]]:items-center [&_[role=menuitem]]:justify-start [&_[role=menuitem]]:gap-3',
  '[&_[role=menuitem]]:rounded-none [&_[role=menuitem]]:border-0 [&_[role=menuitem]]:px-4',
  '[&_[role=menuitem]]:py-2.5 [&_[role=menuitem]]:text-sm [&_[role=menuitem]]:font-normal',
  '[&_[role=menuitem]]:text-graphite [&_[role=menuitem]]:shadow-none [&_[role=menuitem]]:ring-0',
  '[&_[role=menuitem]:hover]:bg-alabaster-900 [&_[role=menuitem]:focus-visible]:bg-alabaster-900',
  '[&_[role=menuitem]:focus-visible]:outline-none [&_[role=menuitem]_svg]:text-graphite-700',
].join(' ')

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
        className={cn(
          'fixed z-40 w-56 rounded border border-alabaster-700 bg-white py-1 text-left shadow-lg',
          ITEM_CLASSES,
          !open && 'hidden'
        )}
      >
        {subscribed && canteenEnabled && <MealDialog kind="change" {...dialog} />}
        <Link href={`/dashboard/cashier/staff/${member.id}`} role="menuitem">
          <FileText className="h-4 w-4" />
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
