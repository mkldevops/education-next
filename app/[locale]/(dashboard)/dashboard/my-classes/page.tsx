import { Breadcrumbs, Card } from '@peaklab/ui'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { readsAsOptedIn } from '@/domain/feature-flags'
import { Link } from '@/i18n/routing'
import { ATTENDANCE_ENABLED_CONFIG_KEY } from '@/lib/attendance-config'
import { db } from '@/lib/db'
import { requireTeacher } from '../../_lib/auth-helper'

export default async function MyClassesPage({ params }: { params: Promise<{ locale: string }> }) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.myClasses')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')
  const { schoolId, teacherId } = await requireTeacher()
  const [classes, attendanceConfig] = await Promise.all([
    db.classPeriod.findMany({
      where: { schoolId, isActive: true, teachers: { some: { teacherId } } },
      select: {
        id: true,
        name: true,
        level: { select: { name: true } },
        period: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    }),
    db.config.findFirst({
      where: { schoolId, name: ATTENDANCE_ENABLED_CONFIG_KEY },
      select: { value: true },
    }),
  ])
  const attendanceEnabled = readsAsOptedIn(attendanceConfig?.value)

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: t('title') },
        ]}
      />
      <h1 className="text-2xl font-bold text-graphite">{t('title')}</h1>
      <Card className="space-y-3 p-6">
        {classes.length === 0 ? (
          <p className="text-graphite-600">{t('empty')}</p>
        ) : (
          classes.map((classPeriod) => (
            <div key={classPeriod.id}>
              <p className="font-medium text-graphite">{classPeriod.name}</p>
              <p className="text-sm text-graphite-600">
                {t('details', { level: classPeriod.level.name, period: classPeriod.period.name })}
              </p>
              {attendanceEnabled && (
                <Link
                  className="text-sm font-medium text-primary"
                  href={`/dashboard/my-classes/${classPeriod.id}/attendance`}
                >
                  {t('attendance')}
                </Link>
              )}
            </div>
          ))
        )}
      </Card>
    </div>
  )
}
