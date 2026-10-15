import { Breadcrumbs, Card, type Column, DataTable, StatusBadge, Tabs } from '@peaklab/ui'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { formatDate } from '@/lib/date'
import { db } from '@/lib/db'
import { formatCurrency } from '@/lib/decimal'
import { isTeacherExpensesEnabled } from '@/use-cases/config/is-teacher-expenses-enabled'
import { requireSchoolAdmin } from '../../_lib/auth-helper'
import { restrictedPageMetadata } from '../../_lib/page-metadata'
import { CreateExpenseDialog } from './_components/create-expense-dialog'
import { CreateTeacherDialog } from './_components/create-teacher-dialog'
import { TeacherActionsMenu } from './_components/teacher-actions-menu'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ tab?: string }>
}

const TAB_KEYS = ['teachers', 'expenses'] as const

const teacherName = (person: { firstName: string; lastName: string }) =>
  `${person.lastName} ${person.firstName}`.trim()

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return restrictedPageMetadata(locale, 'dashboard.pages.teachers.title')
}

export default async function TeachersPage({ params, searchParams }: Props) {
  await connection()
  const { locale } = await params
  const { tab } = await searchParams
  setRequestLocale(locale)

  const { schoolId } = await requireSchoolAdmin()
  const t = await getTranslations('dashboard.pages.teachers')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const [teachers, expenses, expensesEnabled, pendingInvitations] = await Promise.all([
    db.teacher.findMany({
      where: { schoolId, isActive: true },
      include: {
        classPeriods: {
          where: { classPeriod: { isActive: true } },
          select: {
            classPeriod: {
              select: {
                name: true,
                level: { select: { name: true } },
                period: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
    db.teacherExpense.findMany({
      where: { schoolId, isActive: true },
      include: { teacher: { select: { firstName: true, lastName: true } } },
      orderBy: { requestedAt: 'desc' },
    }),
    isTeacherExpensesEnabled(schoolId),
    db.invitation.findMany({
      where: { schoolId, usedAt: null, teacherId: { not: null } },
      select: { teacherId: true, expiresAt: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  const invitationExpiry = new Map(
    pendingInvitations.map((invitation) => [invitation.teacherId, invitation.expiresAt])
  )
  const now = new Date()
  const accessStatus = (teacher: { id: string; userId: string | null }) => {
    if (teacher.userId) return 'active' as const
    const expiresAt = invitationExpiry.get(teacher.id)
    if (!expiresAt) return 'none' as const
    return expiresAt > now ? ('invited' as const) : ('expired' as const)
  }
  const ACCESS_BADGE = {
    active: 'green',
    invited: 'blue',
    expired: 'amber',
    none: 'gray',
  } as const

  const teacherOptions = teachers.map((teacher) => ({
    id: teacher.id,
    name: teacherName(teacher),
  }))

  const teacherColumns: Column<(typeof teachers)[0]>[] = [
    {
      key: 'name',
      header: t('teachers.name'),
      className: 'font-medium text-graphite',
      render: teacherName,
    },
    {
      key: 'email',
      header: t('teachers.email'),
      className: 'text-graphite',
      render: (teacher) => teacher.email || '-',
    },
    {
      key: 'phone',
      header: t('teachers.phone'),
      className: 'text-graphite',
      render: (teacher) => teacher.phone || '-',
    },
    {
      key: 'classes',
      header: t('teachers.classes'),
      className: 'text-graphite',
      render: (teacher) =>
        teacher.classPeriods.length > 0
          ? teacher.classPeriods
              .map(({ classPeriod }) =>
                t('teachers.classLabel', {
                  className: classPeriod.name,
                  level: classPeriod.level.name,
                  period: classPeriod.period.name,
                })
              )
              .join(', ')
          : t('teachers.noClasses'),
    },
    {
      key: 'access',
      header: t('teachers.access'),
      render: (teacher) => {
        const status = accessStatus(teacher)
        return <StatusBadge status={ACCESS_BADGE[status]} label={t(`access.${status}`)} />
      },
    },
    {
      key: 'actions',
      header: t('actions'),
      headerClassName: 'text-right',
      className: 'text-right',
      render: (teacher) => (
        <TeacherActionsMenu
          teacher={{
            id: teacher.id,
            firstName: teacher.firstName,
            lastName: teacher.lastName,
            email: teacher.email,
            phone: teacher.phone,
            userId: teacher.userId,
          }}
          invitationPending={invitationExpiry.has(teacher.id)}
        />
      ),
    },
  ]

  const expenseColumns: Column<(typeof expenses)[0]>[] = [
    {
      key: 'teacher',
      header: t('expenses.teacher'),
      className: 'font-medium text-graphite',
      render: (expense) => teacherName(expense.teacher),
    },
    {
      key: 'amount',
      header: t('expenses.amount'),
      className: 'text-graphite font-medium',
      render: (expense) => formatCurrency(expense.amount, locale),
    },
    {
      key: 'category',
      header: t('expenses.category'),
      className: 'text-graphite',
    },
    {
      key: 'description',
      header: t('expenses.description'),
      className: 'text-graphite',
    },
    {
      key: 'requestedAt',
      header: t('expenses.requestedAt'),
      className: 'text-graphite',
      render: (expense) => formatDate(expense.requestedAt, locale),
    },
    {
      key: 'paidAt',
      header: t('expenses.paidAt'),
      className: 'text-graphite',
      render: (expense) =>
        expense.paidAt ? formatDate(expense.paidAt, locale) : t('expenses.notPaid'),
    },
  ]

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('teachers') },
        ]}
      />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-graphite">{t('title')}</h1>
        <CreateTeacherDialog />
      </div>

      <Tabs
        defaultIndex={
          expensesEnabled ? Math.max(0, TAB_KEYS.indexOf(tab as (typeof TAB_KEYS)[number])) : 0
        }
        tabs={[
          {
            label: t('tabs.teachers'),
            content: (
              <Card className="rounded border border-alabaster-700">
                <DataTable
                  data={teachers}
                  columns={teacherColumns}
                  getRowKey={(teacher) => teacher.id}
                  emptyMessage={t('teachers.empty')}
                />
              </Card>
            ),
          },
          // La configuration `teacher_expenses_enabled` pilote la fonctionnalité entière :
          // l'onglet disparaît au lieu d'ouvrir une vue qui n'annonce que son indisponibilité.
          ...(expensesEnabled
            ? [
                {
                  label: t('tabs.expenses'),
                  content: (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-sm text-graphite-600">{t('expenses.descriptionText')}</p>
                        <CreateExpenseDialog teachers={teacherOptions} />
                      </div>
                      <Card className="rounded border border-alabaster-700">
                        <DataTable
                          data={expenses}
                          columns={expenseColumns}
                          getRowKey={(expense) => expense.id}
                          emptyMessage={t('expenses.empty')}
                        />
                      </Card>
                    </div>
                  ),
                },
              ]
            : []),
        ]}
      />
    </div>
  )
}
