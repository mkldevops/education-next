'use client'

import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import { toast } from '@/lib/toast'
import { activateEnrollmentAction } from '../../../../_lib/enrollment-actions'

type Props = {
  enrollmentId: string
}

export function ActivateEnrollmentButton({ enrollmentId }: Props) {
  const router = useRouter()
  const t = useTranslations('dashboard.pages.familyDetails.childCard')
  const tActions = useTranslations('dashboard.pages.enrollmentDetails.actions')
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    startTransition(async () => {
      const result = await activateEnrollmentAction({ id: enrollmentId })
      if (result === 'OK') {
        toast.success(tActions('activated'))
        router.refresh()
      } else {
        toast.error(
          tActions.has(`errors.${result}`) ? tActions(`errors.${result}`) : tActions('error')
        )
      }
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="shrink-0 rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-900 transition-colors hover:bg-emerald-200 disabled:opacity-60"
    >
      {isPending ? '...' : t('activate')}
    </button>
  )
}
