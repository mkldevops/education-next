import { Breadcrumbs, Card, type Column, DataTable, Tabs } from '@peaklab/ui'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { formatDate } from '@/lib/date'
import { db } from '@/lib/db'
import { formatCurrency } from '@/lib/decimal'
import { TEACHER_EXPENSES_CONFIG_KEY } from '@/lib/teacher-expense-config'
import { requireSchoolAdmin } from '../../_lib/auth-helper'
import { restrictedPageMetadata } from '../../_lib/page-metadata'
import { CreateExpenseDialog } from './_components/create-expense-dialog'
import { CreateTeacherDialog } from './_components/create-teacher-dialog'
import { EditTeacherDialog } from './_components/edit-teacher-dialog'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ tab?: string }>
}

const TAB_KEYS = ['teachers', 'expenses'] as const

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

  const [teachers, expenses, expenseConfig] = await Promise.all([
    db.teacher.findMany({
      where: { schoolId, isActive: true },
      include: {
        classPeriods: {
          where: { classPeriod: { isActive: true } },
          include: { classPeriod: { include: { level: true, period: true } } },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
    db.teacherExpense.findMany({
      where: { schoolId, isActive: true },
      include: { teacher: true },
      orderBy: { requestedAt: 'desc' },
    }),
    db.config.findFirst({
      where: { schoolId, name: TEACHER_EXPENSES_CONFIG_KEY, isActive: true },
      select: { value: true },
    }),
  ])

  const teacherOptions = teachers.map((teacher) => ({
    id: teacher.id,
    name: `${teacher.lastName} ${teacher.firstName}`,
  }))
  const expensesEnabled = expenseConfig?.value === 'true'

  const teacherColumns: Column<(typeof teachers)[0]>[] = [
    {
      key: 'name',
      header: t('teachers.name'),
      className: 'font-medium text-gray-900',
      render: (teacher) => `${teacher.lastName} ${teacher.firstName}`,
    },
    {
      key: 'email',
      header: t('teachers.email'),
      className: 'text-gray-700',
      render: (teacher) => teacher.email || '-',
    },
    {
      key: 'phone',
      header: t('teachers.phone'),
      className: 'text-gray-700',
      render: (teacher) => teacher.phone || '-',
    },
    {
      key: 'classes',
      header: t('teachers.classes'),
      className: 'text-gray-700',
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
      key: 'actions',
      header: t('actions'),
      headerClassName: 'text-right',
      className: 'text-right',
      render: (teacher) => (
        <EditTeacherDialog
          teacher={{
            id: teacher.id,
            firstName: teacher.firstName,
            lastName: teacher.lastName,
            email: teacher.email,
            phone: teacher.phone,
          }}
        />
      ),
    },
  ]

  const expenseColumns: Column<(typeof expenses)[0]>[] = [
    {
      key: 'teacher',
      header: t('expenses.teacher'),
      className: 'font-medium text-gray-900',
      render: (expense) => `${expense.teacher.lastName} ${expense.teacher.firstName}`,
    },
    {
      key: 'amount',
      header: t('expenses.amount'),
      className: 'text-gray-900 font-medium',
      render: (expense) => formatCurrency(expense.amount, locale),
    },
    {
      key: 'category',
      header: t('expenses.category'),
      className: 'text-gray-700',
    },
    {
      key: 'description',
      header: t('expenses.description'),
      className: 'text-gray-700',
    },
    {
      key: 'requestedAt',
      header: t('expenses.requestedAt'),
      className: 'text-gray-700',
      render: (expense) => formatDate(expense.requestedAt, locale),
    },
    {
      key: 'paidAt',
      header: t('expenses.paidAt'),
      className: 'text-gray-700',
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
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <CreateTeacherDialog />
      </div>

      <Tabs
        defaultIndex={Math.max(0, TAB_KEYS.indexOf(tab as (typeof TAB_KEYS)[number]))}
        tabs={[
          {
            label: t('tabs.teachers'),
            content: (
              <Card className="rounded border border-gray-200">
                <DataTable
                  data={teachers}
                  columns={teacherColumns}
                  getRowKey={(teacher) => teacher.id}
                  emptyMessage={t('teachers.empty')}
                />
              </Card>
            ),
          },
          {
            label: t('tabs.expenses'),
            content: (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm text-gray-600">{t('expenses.descriptionText')}</p>
                  {expensesEnabled && <CreateExpenseDialog teachers={teacherOptions} />}
                </div>
                {!expensesEnabled && (
                  <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    {t('expenses.disabled')}
                  </div>
                )}
                <Card className="rounded border border-gray-200">
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
        ]}
      />
    </div>
  )
}
