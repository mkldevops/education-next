'use client'

import { cn } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { toastActionError } from '@/lib/toast'
import { toggleMealAbsenceAction } from '../../../../_lib/meal-actions'

type Member = { id: string; name: string; mealExempt: boolean; today: 'eats' | 'absent' }

type Props = { members: Member[]; today: string }

/** Repas du jour : chacun est compté sauf s'il signale qu'il ne mange pas. */
export function StaffToday({ members, today }: Props) {
  const t = useTranslations('dashboard.pages.cashier.staff')

  return (
    <ul className="max-w-3xl divide-y divide-alabaster-700 rounded border border-alabaster-700">
      {members.map((member) => (
        <StaffTodayRow key={member.id} member={member} today={today} />
      ))}
      {members.length === 0 && (
        <li className="px-4 py-3 text-sm text-graphite-600">{t('todayEmpty')}</li>
      )}
    </ul>
  )
}

function StaffTodayRow({ member, today }: { member: Member; today: string }) {
  const t = useTranslations('dashboard.pages.cashier.staff')
  const tErrors = useTranslations('dashboard.pages.studentDetails.meals.calendar')
  const [isPending, startTransition] = useTransition()
  const eats = member.today === 'eats'

  const toggle = () => {
    startTransition(async () => {
      const result = await toggleMealAbsenceAction({
        teacherId: member.id,
        service: 'CANTEEN',
        day: today,
        absent: eats,
      })
      if (result !== 'OK') toastActionError(tErrors, result)
    })
  }

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2.5">
      <span className="text-sm">
        <span className={eats ? 'text-graphite' : 'text-graphite-600 line-through'}>
          {member.name}
        </span>
        {member.mealExempt && (
          <span className="ml-2 rounded bg-alabaster-900 px-1.5 py-0.5 text-xs text-graphite-600">
            {t('exemptBadge')}
          </span>
        )}
        {!eats && <span className="ml-2 text-xs text-graphite-600">{t('absentToday')}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={eats}
        aria-label={t('eatsTodayToggle', { name: member.name })}
        onClick={toggle}
        disabled={isPending}
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50',
          eats ? 'bg-graphite' : 'bg-alabaster-700'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-4 rounded-full bg-white shadow transition-all',
            eats ? 'right-0.5' : 'left-0.5'
          )}
        />
      </button>
    </li>
  )
}
