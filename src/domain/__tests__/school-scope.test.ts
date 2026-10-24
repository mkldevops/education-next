import { describe, expect, it } from 'vitest'
import type { AuthorizedSchool } from '@/domain/school-scope'
import { classifyDeepLink, reachableSchools } from '@/domain/school-scope'

const SCHOOL_A: AuthorizedSchool = {
  id: 'a',
  name: 'École A',
  slug: 'a',
  isAdmin: true,
  isStaff: true,
}
const SCHOOL_B: AuthorizedSchool = {
  id: 'b',
  name: 'École B',
  slug: 'b',
  isAdmin: true,
  isStaff: true,
}
const SCHOOL_C: AuthorizedSchool = {
  id: 'c',
  name: 'École C',
  slug: 'c',
  isAdmin: false,
  isStaff: false,
}
const SCHOOL_D: AuthorizedSchool = {
  id: 'd',
  name: 'École D',
  slug: 'd',
  isAdmin: false,
  isStaff: true,
}

describe('reachableSchools', () => {
  it('returns every authorized school when administration is not required', () => {
    expect(reachableSchools([SCHOOL_A, SCHOOL_C], false)).toEqual([SCHOOL_A, SCHOOL_C])
  })

  it('drops schools where the user is not staff', () => {
    expect(reachableSchools([SCHOOL_A, SCHOOL_C], true)).toEqual([SCHOOL_A])
  })

  it('keeps schools where a teacher has extended staff access', () => {
    expect(reachableSchools([SCHOOL_C, SCHOOL_D], true)).toEqual([SCHOOL_D])
  })

  it('returns no school when administration is required and none is granted', () => {
    expect(reachableSchools([SCHOOL_C], true)).toEqual([])
  })
})

describe('classifyDeepLink', () => {
  it('renders the page when the resource belongs to the active school', () => {
    const resource = { schoolId: 'a', name: 'Dupont' }

    expect(classifyDeepLink(resource, 'a', [SCHOOL_A, SCHOOL_B])).toEqual({
      status: 'found',
      resource,
    })
  })

  it('offers a switch when the resource belongs to another authorized school', () => {
    const resource = { schoolId: 'b', name: 'Dupont' }

    expect(classifyDeepLink(resource, 'a', [SCHOOL_A, SCHOOL_B])).toEqual({
      status: 'otherSchool',
      school: SCHOOL_B,
    })
  })

  it('reports notFound when the query returned nothing', () => {
    expect(classifyDeepLink(null, 'a', [SCHOOL_A, SCHOOL_B])).toEqual({ status: 'notFound' })
  })

  it('reports notFound rather than a switch when the school is not authorized', () => {
    const resource = { schoolId: 'z', name: 'Dupont' }

    expect(classifyDeepLink(resource, 'a', [SCHOOL_A, SCHOOL_B])).toEqual({ status: 'notFound' })
  })
})
