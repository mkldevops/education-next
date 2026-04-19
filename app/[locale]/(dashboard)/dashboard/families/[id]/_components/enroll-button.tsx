import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'

type Props = {
  familyId: string
  studentId: string
}

export async function EnrollButton({ familyId, studentId }: Props) {
  const t = await getTranslations('dashboard.pages.familyDetails')
  const query = new URLSearchParams({ action: 'addEnrollment', studentId }).toString()

  return (
    <Link
      href={`/dashboard/families/${familyId}?${query}`}
      className="flex-1 px-3 py-2 text-xs font-medium text-center rounded-lg bg-blue-100 text-blue-900 hover:bg-blue-200 transition-colors"
    >
      {t('childCard.enroll')}
    </Link>
  )
}
