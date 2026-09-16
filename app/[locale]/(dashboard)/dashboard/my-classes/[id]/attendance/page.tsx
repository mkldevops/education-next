import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { db } from '@/lib/db'
import { requireTeacher } from '../../../../_lib/auth-helper'
import { AttendancePanel } from './_components/attendance-panel'

export default async function AttendancePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  await connection()
  const { locale, id } = await params
  setRequestLocale(locale)
  const { schoolId, teacherId } = await requireTeacher()
  const classPeriod = await db.classPeriod.findFirst({
    where: { id, schoolId, teachers: { some: { teacherId } } },
    select: { id: true, name: true },
  })
  if (!classPeriod) notFound()
  const t = await getTranslations('dashboard.pages.attendance')
  return (
    <AttendancePanel
      classPeriodId={classPeriod.id}
      className={classPeriod.name}
      labels={{
        title: t('title'),
        start: t('start'),
        allPresent: t('allPresent'),
        draft: t('draft'),
        validate: t('validate'),
        present: t('present'),
        absent: t('absent'),
        unrecorded: t('unrecorded'),
      }}
    />
  )
}
