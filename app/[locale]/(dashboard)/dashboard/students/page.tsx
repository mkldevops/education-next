import { Card, type Column, DataTable } from '@peaklab/ui'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { db } from '@/lib/db'
import { getSessionWithRole } from '../../_lib/auth-helper'
import { CreateStudentDialog } from './_components/create-student-dialog'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'dashboard' })

  return {
    title: t('pages.students.title'),
  }
}

export default async function StudentsPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.students')

  const { roles, familyId } = await getSessionWithRole()

  const whereFamilies = roles.includes('admin') ? undefined : { some: { familyId } }

  const families = roles.includes('admin')
    ? await db.family.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      })
    : familyId
      ? await db.family.findMany({
          where: { id: familyId, isActive: true },
          select: { id: true, name: true },
        })
      : []

  const students = await db.student.findMany({
    where: {
      isActive: true,
      ...(whereFamilies && { person: { families: whereFamilies } }),
    },
    include: {
      person: {
        include: {
          families: {
            include: {
              family: true,
            },
          },
        },
      },
      enrollments: {
        where: { status: { in: ['PENDING', 'ACTIVE'] } },
        include: {
          classAssignments: {
            where: { endAt: null },
            include: {
              classPeriod: true,
            },
          },
        },
      },
    },
    orderBy: { person: { lastname: 'asc' } },
  })

  const columns: Column<(typeof students)[0]>[] = [
    {
      key: 'name',
      header: t('name'),
      render: (student) => (
        <Link
          href={`/dashboard/students/${student.id}`}
          className="text-primary hover:text-primary-hover font-medium"
        >
          {student.person.name} {student.person.lastname}
        </Link>
      ),
    },
    {
      key: 'birthday',
      header: t('birthday'),
      className: 'text-gray-700',
      render: (student) => new Date(student.birthday).toLocaleDateString(locale),
    },
    {
      key: 'family',
      header: t('family'),
      className: 'text-gray-700',
      render: (student) =>
        student.person.families.length > 0 ? student.person.families[0].family.name : '-',
    },
    {
      key: 'class',
      header: t('class'),
      className: 'text-gray-700',
      render: (student) =>
        student.enrollments.length > 0 && student.enrollments[0].classAssignments.length > 0
          ? student.enrollments[0].classAssignments[0].classPeriod.name
          : '-',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        {families.length > 0 && <CreateStudentDialog families={families} />}
      </div>
      <Card className="rounded-xl border border-gray-200">
        <DataTable
          data={students}
          columns={columns}
          getRowKey={(student) => student.id}
          emptyMessage={t('noStudents')}
        />
      </Card>
    </div>
  )
}
