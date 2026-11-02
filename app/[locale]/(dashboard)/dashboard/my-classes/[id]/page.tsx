import { Breadcrumbs, buttonVariants, Card, StatusBadge, Tabs } from '@peaklab/ui'
import { ClipboardCheck, Mail, Phone } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { cache } from 'react'
import { summarizeAttendance } from '@/domain/attendance-summary'
import { readsAsOptedIn } from '@/domain/feature-flags'
import { Link } from '@/i18n/routing'
import { ATTENDANCE_ENABLED_CONFIG_KEY } from '@/lib/attendance-config'
import { calculateAge, formatDate } from '@/lib/date'
import { db } from '@/lib/db'
import { requireTeacher } from '../../../_lib/auth-helper'
import { restrictedPageMetadata } from '../../../_lib/page-metadata'
import { ROSTER_STATUSES } from '../../classes/_lib/roster'

type Props = {
  params: Promise<{ locale: string; id: string }>
}

const HISTORY_LIMIT = 60

const SESSION_BADGE = {
  DRAFT: 'amber',
  VALIDATED: 'green',
  CANCELLED: 'gray',
} as const

/** Classe de l'enseignant courant uniquement : une autre classe répond `notFound()`. */
const findTeacherClass = cache((schoolId: string, teacherId: string, id: string) =>
  db.classPeriod.findFirst({
    where: { id, schoolId, isActive: true, teachers: { some: { teacherId } } },
    select: {
      id: true,
      name: true,
      level: { select: { name: true } },
      period: { select: { name: true } },
    },
  })
)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return restrictedPageMetadata(locale, 'dashboard.pages.myClassDetails.title')
}

export default async function MyClassDetailPage({ params }: Props) {
  await connection()
  const { locale, id } = await params
  setRequestLocale(locale)
  const { schoolId, teacherId } = await requireTeacher()

  const classPeriod = await findTeacherClass(schoolId, teacherId, id)
  if (!classPeriod) notFound()

  const [t, tBreadcrumbs, attendanceConfig, assignments] = await Promise.all([
    getTranslations('dashboard.pages.myClassDetails'),
    getTranslations('dashboard.breadcrumbs'),
    db.config.findFirst({
      where: { schoolId, name: ATTENDANCE_ENABLED_CONFIG_KEY },
      select: { value: true },
    }),
    db.classAssignment.findMany({
      where: {
        schoolId,
        classPeriodId: classPeriod.id,
        endAt: null,
        enrollment: { status: { in: [...ROSTER_STATUSES] }, student: { isActive: true } },
      },
      select: {
        id: true,
        enrollment: {
          select: {
            canLeaveAlone: true,
            student: {
              select: {
                id: true,
                birthday: true,
                allergies: true,
                person: {
                  select: {
                    name: true,
                    lastname: true,
                    sex: true,
                    families: {
                      where: { family: { isActive: true } },
                      select: {
                        family: {
                          select: {
                            id: true,
                            name: true,
                            emergencyContactName: true,
                            emergencyContactPhone: true,
                            persons: {
                              where: {
                                relationType: { in: ['PARENT', 'TUTOR'] },
                                person: { isActive: true },
                              },
                              select: {
                                relationType: true,
                                person: {
                                  select: {
                                    id: true,
                                    name: true,
                                    lastname: true,
                                    email: true,
                                    phoneNumbers: {
                                      where: { isActive: true },
                                      select: { id: true, phoneNumber: true },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
  ])
  const attendanceEnabled = readsAsOptedIn(attendanceConfig?.value)
  const tAttendance = await getTranslations('dashboard.pages.attendance')

  const sessions = attendanceEnabled
    ? await db.attendanceSession.findMany({
        where: { schoolId, classPeriodId: classPeriod.id },
        select: {
          id: true,
          occurredOn: true,
          occurrenceKey: true,
          status: true,
          classScheduleSlot: { select: { id: true, startTime: true, endTime: true } },
          entries: { select: { status: true } },
        },
        orderBy: [{ occurredOn: 'desc' }, { createdAt: 'desc' }],
        take: HISTORY_LIMIT,
      })
    : []

  const today = new Date()
  const roster = assignments
    .map(({ id: assignmentId, enrollment }) => {
      const { student } = enrollment
      return {
        assignmentId,
        name: `${student.person.lastname} ${student.person.name}`,
        birthday: student.birthday,
        sex: student.person.sex,
        allergies: student.allergies,
        canLeaveAlone: enrollment.canLeaveAlone,
        families: student.person.families.map(({ family }) => family),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, locale))

  const history = sessions.map((session) => {
    const date = session.occurredOn.toISOString().slice(0, 10)
    const occurrence =
      session.occurrenceKey === 'daily'
        ? 'occurrence=daily'
        : session.classScheduleSlot
          ? `slotId=${session.classScheduleSlot.id}&occurrence=historical`
          : 'occurrence=historical'
    return {
      id: session.id,
      date,
      status: session.status,
      occurrenceKey: session.occurrenceKey,
      slot: session.classScheduleSlot,
      summary: summarizeAttendance(session.entries.map((entry) => entry.status)),
      href: `/dashboard/my-classes/${classPeriod.id}/attendance?date=${date}&${occurrence}`,
    }
  })
  const todayIso = today.toISOString().slice(0, 10)

  const studentsTab = (
    <Card className="overflow-x-auto rounded border border-alabaster-700">
      {roster.length === 0 ? (
        <p className="p-6 text-sm text-graphite-600">{t('noStudents')}</p>
      ) : (
        <table className="w-full text-left">
          <thead className="bg-alabaster-900">
            <tr className="text-xs font-medium uppercase tracking-wide text-graphite-600">
              <th className="px-4 py-3">{t('student')}</th>
              <th className="px-4 py-3">{t('age')}</th>
              <th className="px-4 py-3">{t('sex')}</th>
              <th className="px-4 py-3">{t('allergies')}</th>
              <th className="px-4 py-3">{t('canLeaveAlone')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-alabaster-800">
            {roster.map((row) => (
              <tr key={row.assignmentId} className="text-sm">
                <td className="px-4 py-3 font-medium text-graphite">{row.name}</td>
                <td className="px-4 py-3 text-graphite tabular-nums">
                  {row.birthday ? t('ageValue', { age: calculateAge(row.birthday, today) }) : '—'}
                </td>
                <td className="px-4 py-3 text-graphite">
                  {row.sex === 'MALE' ? t('male') : row.sex === 'FEMALE' ? t('female') : '—'}
                </td>
                <td className="px-4 py-3 text-graphite">{row.allergies || '—'}</td>
                <td className="px-4 py-3 text-graphite">
                  {row.canLeaveAlone ? t('yes') : t('no')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )

  const contactsTab =
    roster.length === 0 ? (
      <Card className="p-6">
        <p className="text-sm text-graphite-600">{t('noStudents')}</p>
      </Card>
    ) : (
      <ul className="grid gap-4 md:grid-cols-2">
        {roster.map((row) => (
          <li key={row.assignmentId}>
            <Card className="h-full space-y-3 p-4">
              <p className="font-semibold text-graphite">{row.name}</p>
              {row.families.length === 0 ? (
                <p className="text-sm text-graphite-600">{t('noContacts')}</p>
              ) : (
                row.families.map((family) => (
                  <div key={family.id} className="space-y-2 border-t border-alabaster-800 pt-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-graphite-600">
                      {t('family', { name: family.name })}
                    </p>
                    {family.persons.length === 0 && (
                      <p className="text-sm text-graphite-600">{t('noContacts')}</p>
                    )}
                    {family.persons.map(({ relationType, person }) => (
                      <div key={person.id} className="space-y-1 text-sm">
                        <p className="text-graphite">
                          {person.name} {person.lastname}
                          <span className="ml-2 text-xs text-graphite-600">
                            {t(`relation.${relationType}`)}
                          </span>
                        </p>
                        {person.phoneNumbers.map((phone) => (
                          <a
                            key={phone.id}
                            href={`tel:${phone.phoneNumber.replace(/\s/g, '')}`}
                            className="flex items-center gap-2 text-foreground hover:underline"
                          >
                            <Phone aria-hidden="true" className="size-3.5" />
                            {phone.phoneNumber}
                          </a>
                        ))}
                        {person.email && (
                          <a
                            href={`mailto:${person.email}`}
                            className="flex items-center gap-2 break-all text-foreground hover:underline"
                          >
                            <Mail aria-hidden="true" className="size-3.5" />
                            {person.email}
                          </a>
                        )}
                      </div>
                    ))}
                    {family.emergencyContactName && (
                      <p className="text-xs text-graphite-600">
                        {t('emergencyContact', {
                          name: family.emergencyContactName,
                          phone: family.emergencyContactPhone ?? '—',
                        })}
                      </p>
                    )}
                  </div>
                ))
              )}
            </Card>
          </li>
        ))}
      </ul>
    )

  const historyTab = (
    <Card className="overflow-x-auto rounded border border-alabaster-700">
      {history.length === 0 ? (
        <p className="p-6 text-sm text-graphite-600">{t('history.empty')}</p>
      ) : (
        <table className="w-full text-left">
          <thead className="bg-alabaster-900">
            <tr className="text-xs font-medium uppercase tracking-wide text-graphite-600">
              <th className="px-4 py-3">{t('history.date')}</th>
              <th className="px-4 py-3">{t('history.slot')}</th>
              <th className="px-4 py-3">{t('history.status')}</th>
              <th className="px-4 py-3">{t('history.counts')}</th>
              <th className="px-4 py-3">{t('history.rate')}</th>
              <th className="px-4 py-3 text-right">{t('history.open')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-alabaster-800">
            {history.map((row) => (
              <tr key={row.id} className="text-sm">
                <td className="px-4 py-3 text-graphite">{formatDate(row.date, locale)}</td>
                <td className="px-4 py-3 text-graphite tabular-nums">
                  {row.occurrenceKey === 'daily'
                    ? tAttendance('dailyCall')
                    : row.slot
                      ? `${row.slot.startTime} – ${row.slot.endTime}`
                      : t('history.adhoc')}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge
                    status={SESSION_BADGE[row.status]}
                    label={t(`history.statuses.${row.status}`)}
                  />
                </td>
                <td className="px-4 py-3 text-graphite tabular-nums">
                  {t('history.countsValue', {
                    present: row.summary.present,
                    late: row.summary.late,
                    absent: row.summary.absent,
                  })}
                </td>
                <td className="px-4 py-3 font-medium text-graphite tabular-nums">
                  {row.summary.rate === null ? '—' : `${row.summary.rate} %`}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={row.href}
                    className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                  >
                    {t('history.open')}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('myClasses'), href: '/dashboard/my-classes' },
          { label: classPeriod.name },
        ]}
      />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-bold text-graphite">{classPeriod.name}</h1>
          <p className="mt-1 text-sm text-graphite-600">
            {classPeriod.level.name}
            <span className="mx-2 text-graphite-800">·</span>
            {classPeriod.period.name}
            <span className="mx-2 text-graphite-800">·</span>
            {t('count', { count: roster.length })}
          </p>
        </div>
        {attendanceEnabled && (
          <Link
            href={`/dashboard/my-classes/${classPeriod.id}/attendance?date=${todayIso}`}
            className={buttonVariants({ size: 'sm' })}
          >
            <ClipboardCheck className="h-4 w-4" />
            {t('takeAttendance')}
          </Link>
        )}
      </header>

      <Tabs
        tabs={[
          { label: t('tabs.students'), content: studentsTab },
          { label: t('tabs.contacts'), content: contactsTab },
          ...(attendanceEnabled ? [{ label: t('tabs.history'), content: historyTab }] : []),
        ]}
      />
    </div>
  )
}
