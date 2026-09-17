'use client'

import { Button, ConfirmDialog } from '@peaklab/ui'
import { Archive } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { toast, toastActionError } from '@/lib/toast'
import { archiveTeacherAction } from '../../../_lib/teacher-actions'

interface Props {
  teacherId: string
  teacherName: string
  triggerRole?: React.AriaRole
  restoreFocusRef?: React.RefObject<HTMLElement | null>
}

export function ArchiveTeacherDialog({
  teacherId,
  teacherName,
  triggerRole,
  restoreFocusRef,
}: Props) {
  const t = useTranslations('dashboard.pages.teachers.archive')
  const router = useRouter()

  const onConfirm = async () => {
    const result = await archiveTeacherAction(teacherId)
    if (result !== 'OK') return toastActionError(t, result)
    toast.success(t('success'))
    router.refresh()
  }

  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="sm" role={triggerRole}>
          <Archive className="h-4 w-4" />
          {t('trigger')}
        </Button>
      }
      title={t('title')}
      description={t('description', { name: teacherName })}
      confirmLabel={t('confirm')}
      cancelLabel={t('cancel')}
      variant="default"
      onConfirm={onConfirm}
      restoreFocusRef={restoreFocusRef}
    />
  )
}
