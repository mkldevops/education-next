'use client'

import { Button, ConfirmDialog } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import type { MealService } from '@/generated/prisma/enums'
import { toast, toastActionError } from '@/lib/toast'
import { removeStaffMealAction } from '../../../_lib/meal-actions'

type Props = { teacherId: string; service: MealService; name: string }

export function RemoveStaffMealButton({ teacherId, service, name }: Props) {
  const t = useTranslations('dashboard.pages.meals.staff.remove')

  const handleConfirm = async () => {
    const result = await removeStaffMealAction({ teacherId, service })
    if (result !== 'OK') {
      toastActionError(t, result)
      return
    }
    toast.success(t('success'))
  }

  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="sm">
          {t('trigger')}
        </Button>
      }
      title={t('title', { name })}
      description={t('description')}
      confirmLabel={t('confirm')}
      cancelLabel={t('cancel')}
      onConfirm={handleConfirm}
    />
  )
}
