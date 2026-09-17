'use client'

import { Button, ConfirmDialog } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { toast, toastActionError } from '@/lib/toast'
import { deactivateClassPeriodAction } from '../../../_lib/class-period-actions'

interface DeleteClassDialogProps {
  classPeriodId: string
  className: string
  triggerRole?: React.AriaRole
  restoreFocusRef?: React.RefObject<HTMLElement | null>
}

export function DeleteClassDialog({
  classPeriodId,
  className,
  triggerRole,
  restoreFocusRef,
}: DeleteClassDialogProps) {
  const t = useTranslations('dashboard.pages.classes.delete')
  const router = useRouter()

  const onConfirm = async () => {
    const result = await deactivateClassPeriodAction(classPeriodId)
    if (result !== 'OK') {
      toastActionError(t, result)
      return
    }

    toast.success(t('success'))
    router.push('/dashboard/classes')
  }

  return (
    <ConfirmDialog
      trigger={
        <Button
          variant="destructive"
          size="sm"
          role={triggerRole}
          aria-label={t('deleteTriggerLabel', { name: className })}
        >
          {t('trigger')}
        </Button>
      }
      title={t('title')}
      description={t('description', { name: className })}
      confirmLabel={t('confirm')}
      cancelLabel={t('cancel')}
      onConfirm={onConfirm}
      restoreFocusRef={restoreFocusRef}
    />
  )
}
