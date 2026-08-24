import { buttonVariants } from '@peaklab/ui'
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
      className={buttonVariants({ size: 'sm', className: 'flex-1' })}
    >
      {t('childCard.enroll')}
    </Link>
  )
}
