import { Card } from '@peaklab/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { StatusBadge } from '@/features/dashboard'
import { db } from '@/lib/db'
import { formatAmount } from '@/lib/decimal'
import { EnrollmentActions } from './_components/enrollment-actions'

type Props = {
  params: Promise<{ locale: string; id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const enrollment = await db.enrollment.findUnique({
    where: { id },
    include: { student: { include: { person: true } } },
  })

  return {
    title: enrollment
      ? `${enrollment.student.person.name} ${enrollment.student.person.lastname} - Enrollment`
      : 'Enrollment',
  }
}

export default async function EnrollmentDetailPage({ params }: Props) {
  const { locale, id } = await params
  setRequestLocale(locale)

  const enrollment = await db.enrollment.findUnique({
    where: { id },
    include: {
      student: {
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
        },
      },
      plan: true,
      classAssignments: {
        include: {
          classPeriod: {
            include: {
              level: true,
              period: true,
            },
          },
        },
      },
      payments: {
        orderBy: { paidAt: 'desc' },
      },
    },
  })

  if (!enrollment) notFound()

  const familyName =
    enrollment.student.person.families.length > 0
      ? enrollment.student.person.families[0].family.name
      : '-'

  const totalPaid = enrollment.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
  const remainingAmount = Number(enrollment.totalAmount) - Number(enrollment.discount) - totalPaid

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {enrollment.student.person.name} {enrollment.student.person.lastname}
        </h1>
        <p className="mt-1 text-sm text-gray-600">Enrollment Details</p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium text-gray-500">Plan</h3>
            <p className="mt-1 text-sm text-gray-900">{enrollment.plan.name}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Status</h3>
            <div className="mt-1">
              <StatusBadge status={enrollment.status} />
            </div>
            <div className="mt-3">
              <EnrollmentActions enrollmentId={enrollment.id} status={enrollment.status} />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Family</h3>
            <p className="mt-1 text-sm text-gray-900">{familyName}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Registered</h3>
            <p className="mt-1 text-sm text-gray-900">
              {new Date(enrollment.registeredAt).toLocaleDateString(locale)}
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Pricing</h2>
        <div className="space-y-3 border-t pt-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Total Amount</span>
            <span className="text-sm font-medium text-gray-900">
              €{formatAmount(enrollment.totalAmount)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Discount</span>
            <span className="text-sm font-medium text-gray-900">
              -€{formatAmount(enrollment.discount)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Total Paid</span>
            <span className="text-sm font-medium text-gray-900">€{formatAmount(totalPaid)}</span>
          </div>
          <div className="border-t pt-3 flex justify-between items-center">
            <span className="font-medium text-gray-900">Remaining</span>
            <span className="font-medium text-gray-900">
              €{formatAmount(Math.max(0, remainingAmount))}
            </span>
          </div>
        </div>
      </Card>

      {enrollment.classAssignments.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Class Assignments</h2>
          <div className="rounded-lg border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Class</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Level</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Period</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    Start Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {enrollment.classAssignments.map((assignment) => (
                  <tr key={assignment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{assignment.classPeriod.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {assignment.classPeriod.level.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {assignment.classPeriod.period.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {new Date(assignment.startAt).toLocaleDateString(locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {enrollment.payments.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Payments</h2>
          <div className="rounded-lg border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Method</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    Reference
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Paid At</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    Cashed At
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {enrollment.payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      €{formatAmount(payment.amount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{payment.method}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{payment.reference || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {new Date(payment.paidAt).toLocaleDateString(locale)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {payment.cashedAt
                        ? new Date(payment.cashedAt).toLocaleDateString(locale)
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
