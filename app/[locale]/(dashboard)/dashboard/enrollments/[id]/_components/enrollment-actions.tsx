'use client'

import { Button } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useRouter } from '@/i18n/routing'
import {
  activateEnrollmentAction,
  cancelEnrollmentAction,
  completeEnrollmentAction,
} from '../_lib/enrollment-actions'

type Props = {
  enrollmentId: string
  status: string
}

export function EnrollmentActions({ enrollmentId, status }: Props) {
  const router = useRouter()
  const t = useTranslations('dashboard.pages.enrollmentDetails.actions')
  const [loading, setLoading] = useState(false)

  const handleAction = async (action: (id: string) => Promise<string>) => {
    setLoading(true)
    const result = await action(enrollmentId)
    setLoading(false)
    if (result === 'OK') {
      router.refresh()
    }
  }

  return (
    <div className="flex gap-2">
      {status === 'PENDING' && (
        <>
          <Button
            size="sm"
            disabled={loading}
            onClick={() => handleAction(activateEnrollmentAction)}
          >
            {t('activate')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => handleAction(cancelEnrollmentAction)}
          >
            {t('cancel')}
          </Button>
        </>
      )}
      {status === 'ACTIVE' && (
        <>
          <Button
            size="sm"
            disabled={loading}
            onClick={() => handleAction(completeEnrollmentAction)}
          >
            {t('complete')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => handleAction(cancelEnrollmentAction)}
          >
            {t('cancel')}
          </Button>
        </>
      )}
    </div>
  )
}
