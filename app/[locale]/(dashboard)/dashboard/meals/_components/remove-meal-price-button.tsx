'use client'

import { Button, ConfirmDialog } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { toast, toastActionError } from '@/lib/toast'
import { removeMealPriceAction } from '../../../_lib/meal-actions'

export function RemoveMealPriceButton({ id }: { id: string }) {
  const t = useTranslations('dashboard.pages.meals.removePrice')

  const handleConfirm = async () => {
    const result = await removeMealPriceAction(id)
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
      title={t('title')}
      description={t('description')}
      confirmLabel={t('confirm')}
      cancelLabel={t('cancel')}
      onConfirm={handleConfirm}
    />
  )
}
