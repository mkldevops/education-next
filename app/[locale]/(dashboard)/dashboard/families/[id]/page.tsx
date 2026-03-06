import { Card } from '@peaklab/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { StatusBadge } from '@/features/dashboard'
import { db } from '@/lib/db'
import { formatAmount } from '@/lib/decimal'

type Props = {
  params: Promise<{ locale: string; id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const family = await db.family.findUnique({ where: { id } })

  return {
    title: family?.name || 'Family',
  }
}

export default async function FamilyDetailPage({ params }: Props) {
  const { locale, id } = await params
  setRequestLocale(locale)

  const family = await db.family.findUnique({
    where: { id },
    include: {
      persons: {
        where: { person: { isActive: true } },
        include: {
          person: {
            include: {
              student: {
                where: { isActive: true },
                include: {
                  enrollments: {
                    where: { isActive: true },
                    include: {
                      plan: true,
                      classAssignments: {
                        where: { endAt: null },
                        include: {
                          classPeriod: true,
                        },
                      },
                    },
                  },
                },
              },
              phoneNumbers: {
                where: { isActive: true },
              },
            },
          },
        },
      },
      payments: true,
    },
  })

  if (!family) notFound()

  const students = family.persons.filter((fp) => fp.person.student)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{family.name}</h1>
        <p className="mt-1 text-sm text-gray-600">Family Details</p>
      </div>

      <Card className="p-6 space-y-4">
        <div>
          <h3 className="text-sm font-medium text-gray-500">Emergency Contact</h3>
          <p className="mt-1 text-sm text-gray-900">{family.emergencyContact || '-'}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-500">Authorized Pickup</h3>
          <p className="mt-1 text-sm text-gray-900">{family.authorizedPickup || '-'}</p>
        </div>
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Family Members</h2>
        <div className="rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  Relation Type
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Email</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Phone</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {family.persons.map((fp) => (
                <tr key={fp.personId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    {fp.person.name} {fp.person.lastname}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{fp.relationType}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{fp.person.email || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {fp.person.phoneNumbers[0]?.phoneNumber || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {students.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Students</h2>
          <div className="rounded-lg border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    Birthday
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    Birthplace
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    Allergies
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {students.map((student) => {
                  const s = student.person.student
                  if (!s) return null
                  return (
                    <tr key={student.person.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        {student.person.name} {student.person.lastname}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {new Date(s.birthday).toLocaleDateString(locale)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{s.birthplace || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{s.allergies || '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {students.some((s) => (s.person.student?.enrollments.length ?? 0) > 0) && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Enrollments</h2>
          <div className="rounded-lg border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Student</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Plan</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {students.flatMap((student) =>
                  (student.person.student?.enrollments ?? []).map((enrollment) => (
                    <tr key={enrollment.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        {student.person.name} {student.person.lastname}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{enrollment.plan.name}</td>
                      <td className="px-4 py-3 text-sm">
                        <StatusBadge status={enrollment.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        €{formatAmount(enrollment.totalAmount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
