'use client'

import { Button, ConfirmDialog } from '@peaklab/ui'
import { Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast, toastActionError } from '@/lib/toast'
import { deleteClassScheduleSlotAction } from '../../../_lib/class-schedule-actions'

export function DeleteScheduleSlotDialog({ slotId }: { slotId: string }) {
  const t = useTranslations('dashboard.pages.planning')
  const tCommon = useTranslations('common')

  const onConfirm = async () => {
    const result = await deleteClassScheduleSlotAction({ id: slotId })
    if (typeof result === 'string') {
      toastActionError(t, result)
      return
    }
    toast.success(t('successDeleted'))
  }

  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="sm" aria-label={t('delete.trigger')}>
          <Trash2 className="h-4 w-4" />
        </Button>
      }
      title={t('delete.title')}
      description={t('delete.description')}
      confirmLabel={t('delete.confirm')}
      cancelLabel={tCommon('cancel')}
      onConfirm={onConfirm}
    />
  )
}
