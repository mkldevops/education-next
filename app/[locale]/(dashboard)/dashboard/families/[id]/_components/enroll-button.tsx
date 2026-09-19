import { buttonVariants } from '@peaklab/ui'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { familyActionHref } from '../_lib/family-action-href'

type Props = {
  familyId: string
  studentId: string
}

export async function EnrollButton({ familyId, studentId }: Props) {
  const t = await getTranslations('dashboard.pages.familyDetails')

  return (
    <Link
      href={familyActionHref(familyId, 'addEnrollment', { studentId })}
      className={buttonVariants({ size: 'sm', className: 'flex-1' })}
    >
      {t('childCard.enroll')}
    </Link>
  )
}
