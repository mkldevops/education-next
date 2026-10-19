import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StudentRow } from './students-data-table'
import { StudentsDataTable } from './students-data-table'

vi.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${Object.values(values).join(',')}` : key
    t.has = () => true
    return t
  },
}))

vi.mock('next-intl/navigation', () => ({
  createNavigation: () => ({
    Link: 'a',
    redirect: vi.fn(),
    usePathname: vi.fn(),
    useRouter: vi.fn(),
    getPathname: vi.fn(),
  }),
}))

const baseStudent: Omit<StudentRow, 'id' | 'birthday' | 'person'> = {
  schoolId: 'school-1',
  personId: 'person-1',
  birthplace: null,
  previousSchool: null,
  healthNotes: null,
  snackAuthorization: false,
  allergies: null,
  isActive: true,
  createdAt: new Date('2020-01-01T00:00:00Z'),
  updatedAt: new Date('2020-01-01T00:00:00Z'),
  enrollments: [],
}

const basePerson: Omit<StudentRow['person'], 'name' | 'lastname'> = {
  id: 'person-1',
  schoolId: 'school-1',
  sex: 'FEMALE',
  email: null,
  address: null,
  postCode: null,
  city: null,
  isActive: true,
  createdAt: new Date('2020-01-01T00:00:00Z'),
  updatedAt: new Date('2020-01-01T00:00:00Z'),
  families: [],
}

const student = (id: string, name: string, birthday: string): StudentRow => ({
  ...baseStudent,
  id,
  birthday: new Date(birthday),
  person: { ...basePerson, name, lastname: 'Test' },
})

// Same rationale as payments-table.test.tsx: three dates whose fr-FR formatted lexicographic
// order is a genuine permutation of their chronological order, not just its exact reverse, so
// a sort that merely flips direction can't accidentally look correct. The years are also far
// enough apart to give three distinct ages: with a tie, swapping two rows would go unnoticed.
const studentA = student('student-a', 'Alice', '2018-03-05T00:00:00Z') // '05/03/2018', 8 yrs
const studentB = student('student-b', 'Bob', '2020-11-20T00:00:00Z') // '20/11/2020', 5 yrs
const studentC = student('student-c', 'Chloe', '2022-01-10T00:00:00Z') // '10/01/2022', 4 yrs

describe('StudentsDataTable', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sorts the age column chronologically, not lexicographically', () => {
    render(
      <StudentsDataTable
        data={[studentB, studentC, studentA]}
        locale="fr"
        isStaff={false}
        plans={[]}
        classes={[]}
        paymentsEnabled={true}
        today={new Date('2026-06-01T00:00:00Z')}
      />
    )

    const sortButton = screen.getByRole('button', { name: 'age' })
    const readAges = () =>
      screen
        .getAllByRole('row')
        .slice(1)
        .map((row) => within(row).getAllByRole('cell')[1].textContent)

    // Chronological order, oldest student first.
    const ascending = ['ageValue:8', 'ageValue:5', 'ageValue:4']
    const descending = [...ascending].reverse()

    fireEvent.click(sortButton)
    const firstClick = readAges()
    expect([ascending, descending]).toContainEqual(firstClick)

    fireEvent.click(sortButton)
    const secondClick = readAges()
    expect([ascending, descending]).toContainEqual(secondClick)
    expect(secondClick).not.toEqual(firstClick)
  })

  it('reveals the exact birth date on click', () => {
    render(
      <StudentsDataTable
        data={[studentA]}
        locale="fr"
        isStaff={false}
        plans={[]}
        classes={[]}
        paymentsEnabled={true}
        today={new Date('2026-06-01T00:00:00Z')}
      />
    )

    expect(screen.queryByText('05/03/2018')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'ageValue:8' }))

    expect(screen.getByText('05/03/2018')).toBeInTheDocument()
  })
})
