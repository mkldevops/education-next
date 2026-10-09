import { Breadcrumbs, Card, StatusBadge } from '@peaklab/ui'
import { Mail, Phone } from 'lucide-react'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { calculateAge } from '@/lib/date'
import { db } from '@/lib/db'
import { requireTeacher } from '../../_lib/auth-helper'
import { restrictedPageMetadata } from '../../_lib/page-metadata'
import { TeacherFamilyDialog } from './_components/teacher-family-dialog'
import { TeacherStudentDialog } from './_components/teacher-student-dialog'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return restrictedPageMetadata(locale, 'dashboard.pages.myFamilies.title')
}

/** Familles saisies par l'enseignant courant ; l'inscription reste à l'administration. */
export default async function MyFamiliesPage({ params }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)
  const { schoolId, userId } = await requireTeacher()

  const [t, tBreadcrumbs, families] = await Promise.all([
    getTranslations('dashboard.pages.myFamilies'),
    getTranslations('dashboard.breadcrumbs'),
    db.family.findMany({
      where: { schoolId, createdById: userId, isActive: true },
      select: {
        id: true,
        name: true,
        persons: {
          where: { person: { isActive: true } },
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
                student: {
                  select: {
                    id: true,
                    birthday: true,
                    enrollments: {
                      where: { status: { in: ['PENDING', 'ACTIVE'] } },
                      select: { id: true },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const today = new Date()

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('myFamilies') },
        ]}
      />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-graphite">{t('title')}</h1>
          <p className="mt-1 text-sm text-graphite-600">{t('description')}</p>
        </div>
        <TeacherFamilyDialog />
      </header>

      {families.length === 0 ? (
        <Card className="p-6">
          <p className="text-sm text-graphite-600">{t('empty')}</p>
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {families.map((family) => {
            const students = family.persons.filter(({ person }) => person.student)
            const contacts = family.persons.filter(({ person }) => !person.student)
            return (
              <li key={family.id}>
                <Card className="h-full space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="break-words text-lg font-semibold text-graphite">
                      {family.name}
                    </h2>
                    <TeacherStudentDialog familyId={family.id} />
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-graphite-600">
                      {t('contacts')}
                    </p>
                    {contacts.length === 0 && (
                      <p className="text-sm text-graphite-600">{t('noContacts')}</p>
                    )}
                    {contacts.map(({ person }) => (
                      <div key={person.id} className="space-y-1 text-sm">
                        <p className="text-graphite">
                          {person.name} {person.lastname}
                        </p>
                        {person.phoneNumbers.map((phone) => (
                          <p key={phone.id} className="flex items-center gap-2 text-graphite-600">
                            <Phone aria-hidden="true" className="size-3.5" />
                            {phone.phoneNumber}
                          </p>
                        ))}
                        {person.email && (
                          <p className="flex items-center gap-2 break-all text-graphite-600">
                            <Mail aria-hidden="true" className="size-3.5" />
                            {person.email}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 border-t border-alabaster-800 pt-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-graphite-600">
                      {t('students')}
                    </p>
                    {students.length === 0 && (
                      <p className="text-sm text-graphite-600">{t('noStudents')}</p>
                    )}
                    <ul className="space-y-2">
                      {students.map(({ person }) => {
                        const enrolled = (person.student?.enrollments.length ?? 0) > 0
                        return (
                          <li
                            key={person.id}
                            className="flex items-center justify-between gap-3 text-sm"
                          >
                            <span className="text-graphite">
                              {person.lastname} {person.name}
                              {person.student?.birthday && (
                                <span className="ml-2 text-graphite-600">
                                  {t('age', {
                                    age: calculateAge(person.student.birthday, today),
                                  })}
                                </span>
                              )}
                            </span>
                            <StatusBadge
                              status={enrolled ? 'green' : 'amber'}
                              label={enrolled ? t('enrolled') : t('awaitingEnrollment')}
                            />
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
