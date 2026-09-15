'use client'

import { Button, ConfirmDialog } from '@peaklab/ui'
import { Archive } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast, toastActionError } from '@/lib/toast'
import { archiveEventAction } from '../../../_lib/event-actions'

type Props = {
  eventId: string
}

export function ArchiveEventDialog({ eventId }: Props) {
  const t = useTranslations('dashboard.pages.events')
  const tCommon = useTranslations('common')

  const handleConfirm = async () => {
    const result = await archiveEventAction(eventId)
    if (typeof result === 'string') {
      toastActionError(t, result)
      return
    }
    toast.success(t('success.archived'))
  }

  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm">
          <Archive className="h-4 w-4" />
          {t('archive.trigger')}
        </Button>
      }
      title={t('archive.title')}
      description={t('archive.description')}
      confirmLabel={t('archive.confirm')}
      cancelLabel={tCommon('cancel')}
      onConfirm={handleConfirm}
    />
  )
}
