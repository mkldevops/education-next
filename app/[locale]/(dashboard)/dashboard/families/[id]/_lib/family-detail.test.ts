import { describe, expect, it } from 'vitest'
import { deriveFamilyDetail, type FamilyDetail, serializeFamilyPayments } from './family-detail'

const decimal = (value: number) => ({ toString: () => String(value) })

describe('family detail serialization', () => {
  it('converts every student enrollment Decimal before rendering client tabs', () => {
    const family = {
      persons: [
        {
          person: {
            name: 'Léo',
            lastname: 'Martin',
            student: {
              id: 'student-1',
              enrollments: [
                {
                  id: 'enrollment-1',
                  status: 'ACTIVE',
                  totalAmount: decimal(350),
                  discount: decimal(25),
                  plan: { amount: decimal(375) },
                  payments: [{ amount: decimal(100) }],
                  classAssignments: [],
                },
              ],
            },
          },
        },
      ],
    } as unknown as FamilyDetail

    const result = deriveFamilyDetail(family, undefined)
    const enrollment = result.students[0]?.person.student.enrollments[0]

    expect(enrollment).toMatchObject({
      totalAmount: 350,
      discount: 25,
      plan: { amount: 375 },
      payments: [{ amount: 100 }],
    })
  })

  it('converts payment and nested enrollment Decimals before rendering client tabs', () => {
    const payments = [
      {
        amount: decimal(100),
        enrollment: {
          totalAmount: decimal(350),
          discount: decimal(25),
          plan: { amount: decimal(375) },
        },
      },
    ] as unknown as FamilyDetail['payments']

    expect(serializeFamilyPayments(payments)).toMatchObject([
      {
        amount: 100,
        enrollment: {
          totalAmount: 350,
          discount: 25,
          plan: { amount: 375 },
        },
      },
    ])
  })
})
