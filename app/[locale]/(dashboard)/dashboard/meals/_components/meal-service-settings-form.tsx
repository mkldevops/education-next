'use client'

import { Button } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { type FormEvent, useTransition } from 'react'
import type { MealService } from '@/generated/prisma/enums'
import { toast, toastActionError } from '@/lib/toast'
import { setMealServiceSettingAction } from '../../../_lib/meal-actions'

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const

type Props = {
  service: MealService
  isEnabled: boolean
  allowedWeekdays: number[]
}

export function MealServiceSettingsForm({ service, isEnabled, allowedWeekdays }: Props) {
  const t = useTranslations('dashboard.pages.meals.settings')
  const tWeekdays = useTranslations('dashboard.pages.meals.weekdays')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await setMealServiceSettingAction({
        service,
        isEnabled: formData.get('isEnabled') === 'on',
        allowedWeekdays: formData.getAll('weekday').map(Number),
      })
      if (result !== 'OK') {
        toastActionError(t, result)
        return
      }
      toast.success(t('success'))
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="flex items-start gap-2 text-sm text-graphite">
        <input
          type="checkbox"
          name="isEnabled"
          defaultChecked={isEnabled}
          className="mt-0.5 rounded"
          disabled={isPending}
        />
        <span>
          <span className="font-medium">{t('isEnabled')}</span>
          <span className="block text-xs text-graphite-600">{t('isEnabledHint')}</span>
        </span>
      </label>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-graphite">{t('weekdays')}</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {WEEKDAYS.map((day) => (
            <label key={day} className="flex items-center gap-2 text-sm text-graphite">
              <input
                type="checkbox"
                name="weekday"
                value={day}
                defaultChecked={allowedWeekdays.includes(day)}
                className="rounded"
                disabled={isPending}
              />
              {tWeekdays(String(day))}
            </label>
          ))}
        </div>
      </fieldset>
      <Button type="submit" size="sm" disabled={isPending}>
        {t('submit')}
      </Button>
    </form>
  )
}
