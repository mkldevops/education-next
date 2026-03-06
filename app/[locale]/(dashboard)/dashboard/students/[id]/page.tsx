import { Card } from '@peaklab/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { StatusBadge } from '@/features/dashboard'
import { db } from '@/lib/db'

type Props = {
  params: Promise<{ locale: string; id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params
  const student = await db.student.findUnique({
    where: { id },
    include: { person: true },
  })

  return {
    title: student ? `${student.person.name} ${student.person.lastname}` : 'Student',
  }
}

export default async function StudentDetailPage({ params }: Props) {
  const { locale, id } = await params
  setRequestLocale(locale)

  const student = await db.student.findUnique({
    where: { id },
    include: {
      person: {
        include: {
          families: {
            include: {
              family: true,
            },
          },
          phoneNumbers: true,
        },
      },
      enrollments: {
        include: {
          plan: true,
          classAssignments: {
            include: {
              classPeriod: {
                include: {
                  period: true,
                  level: true,
                },
              },
            },
          },
          payments: true,
        },
        orderBy: { registeredAt: 'desc' },
      },
    },
  })

  if (!student) notFound()

  const languagesAtHome = Array.isArray(student.languagesAtHome)
    ? student.languagesAtHome.join(', ')
    : '-'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {student.person.name} {student.person.lastname}
        </h1>
        <p className="mt-1 text-sm text-gray-600">Student Details</p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium text-gray-500">Birthday</h3>
            <p className="mt-1 text-sm text-gray-900">
              {new Date(student.birthday).toLocaleDateString(locale)}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Birthplace</h3>
            <p className="mt-1 text-sm text-gray-900">{student.birthplace || '-'}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Email</h3>
            <p className="mt-1 text-sm text-gray-900">{student.person.email || '-'}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Address</h3>
            <p className="mt-1 text-sm text-gray-900">{student.person.address || '-'}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Allergies</h3>
            <p className="mt-1 text-sm text-gray-900">{student.allergies || '-'}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Languages at Home</h3>
            <p className="mt-1 text-sm text-gray-900">{languagesAtHome}</p>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-500">Health Notes</h3>
          <p className="mt-1 text-sm text-gray-900">{student.healthNotes || '-'}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-500">Family</h3>
          <p className="mt-1 text-sm text-gray-900">
            {student.person.families.length > 0 ? student.person.families[0].family.name : '-'}
          </p>
        </div>
      </Card>

      {student.enrollments.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Enrollments</h2>
          <div className="rounded-lg border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Plan</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Class</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Total</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    Registered
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {student.enrollments.map((enrollment) => {
                  const className =
                    enrollment.classAssignments.length > 0
                      ? enrollment.classAssignments[0].classPeriod.name
                      : '-'

                  return (
                    <tr key={enrollment.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{enrollment.plan.name}</td>
                      <td className="px-4 py-3 text-sm">
                        <StatusBadge status={enrollment.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{className}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        €{enrollment.totalAmount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {new Date(enrollment.registeredAt).toLocaleDateString(locale)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
