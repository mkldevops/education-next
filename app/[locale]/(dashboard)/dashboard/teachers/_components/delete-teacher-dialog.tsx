'use client'

import { Button, ConfirmDialog } from '@peaklab/ui'
import { Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { toast, toastActionError } from '@/lib/toast'
import { deleteTeacherAction } from '../../../_lib/teacher-actions'

interface Props {
  teacherId: string
  teacherName: string
  triggerRole?: React.AriaRole
  restoreFocusRef?: React.RefObject<HTMLElement | null>
}

export function DeleteTeacherDialog({
  teacherId,
  teacherName,
  triggerRole,
  restoreFocusRef,
}: Props) {
  const t = useTranslations('dashboard.pages.teachers.delete')
  const router = useRouter()

  const onConfirm = async () => {
    const result = await deleteTeacherAction(teacherId)
    if (result !== 'OK') return toastActionError(t, result)
    toast.success(t('success'))
    router.refresh()
  }

  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="sm" role={triggerRole} className="text-red-600">
          <Trash2 className="h-4 w-4" />
          {t('trigger')}
        </Button>
      }
      title={t('title')}
      description={t('description', { name: teacherName })}
      confirmLabel={t('confirm')}
      cancelLabel={t('cancel')}
      onConfirm={onConfirm}
      restoreFocusRef={restoreFocusRef}
    />
  )
}
