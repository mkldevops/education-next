'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'

type Props = {
  familyId: string
  studentId: string
}

export function EnrollButton({ familyId, studentId }: Props) {
  const t = useTranslations('dashboard.pages.familyDetails')
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() =>
        router.push(`/dashboard/families/${familyId}?action=addEnrollment&studentId=${studentId}`)
      }
      className="flex-1 px-3 py-2 text-xs font-medium text-center rounded-lg bg-blue-100 text-blue-900 hover:bg-blue-200 transition-colors"
    >
      {t('childCard.enroll')}
    </button>
  )
}
