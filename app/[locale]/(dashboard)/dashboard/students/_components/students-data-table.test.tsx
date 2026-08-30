import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { StudentRow } from './students-data-table'
import { StudentsDataTable } from './students-data-table'

vi.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => key
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
  languagesAtHome: [],
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
// a sort that merely flips direction can't accidentally look correct.
const studentA = student('student-a', 'Alice', '2023-03-05T00:00:00Z') // '05/03/2023'
const studentB = student('student-b', 'Bob', '2024-11-20T00:00:00Z') // '20/11/2024'
const studentC = student('student-c', 'Chloe', '2025-01-10T00:00:00Z') // '10/01/2025'

describe('StudentsDataTable', () => {
  it('sorts the birthday column chronologically, not lexicographically', () => {
    render(<StudentsDataTable data={[studentB, studentC, studentA]} locale="fr" isAdmin={false} />)

    const sortButton = screen.getByRole('button', { name: 'birthday' })
    const readBirthdays = () =>
      screen
        .getAllByRole('row')
        .slice(1)
        .map((row) => within(row).getAllByRole('cell')[1].textContent)

    const ascending = ['05/03/2023', '20/11/2024', '10/01/2025']
    const descending = [...ascending].reverse()

    fireEvent.click(sortButton)
    const firstClick = readBirthdays()
    expect([ascending, descending]).toContainEqual(firstClick)

    fireEvent.click(sortButton)
    const secondClick = readBirthdays()
    expect([ascending, descending]).toContainEqual(secondClick)
    expect(secondClick).not.toEqual(firstClick)
  })
})
