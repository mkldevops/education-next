import { beforeEach, describe, expect, it } from 'vitest'
import type { schoolGateway } from '@/gateways/school-gateway'
import { createSchool } from './create-school'
import { deactivateSchool } from './deactivate-school'
import { reactivateSchool } from './reactivate-school'
import { updateSchool } from './update-school'

type StoredSchool = {
  id: string
  name: string
  slug: string
  address: string | null
  postCode: string | null
  city: string | null
  isActive: boolean
}

class SchoolGatewaySpy {
  schools: StoredSchool[] = []
  deactivateResult: Awaited<ReturnType<typeof schoolGateway.deactivate>> = { status: 'OK' }
  deactivateCalls: string[] = []
  reactivateCalls: string[] = []
  createCalls: unknown[] = []
  updateCalls: Array<{ id: string; data: unknown }> = []

  async findById(id: string) {
    return this.schools.find((school) => school.id === id) ?? null
  }

  async findBySlug(slug: string) {
    return this.schools.find((school) => school.slug === slug) ?? null
  }

  async create(data: unknown) {
    this.createCalls.push(data)
    return {} as never
  }

  async update(id: string, data: unknown) {
    this.updateCalls.push({ id, data })
    return {} as never
  }

  async deactivate(id: string) {
    this.deactivateCalls.push(id)
    return this.deactivateResult
  }

  async reactivate(id: string) {
    this.reactivateCalls.push(id)
    return {} as never
  }
}

function asGateway(gateway: SchoolGatewaySpy) {
  return gateway as unknown as typeof schoolGateway
}

const SCHOOL_ID = '123e4567-e89b-12d3-a456-426614174001'
const OTHER_ID = '123e4567-e89b-12d3-a456-426614174002'
const MISSING_ID = '123e4567-e89b-12d3-a456-426614174099'

const stored = (over: Partial<StoredSchool> = {}): StoredSchool => ({
  id: SCHOOL_ID,
  name: 'École Al-Nour',
  slug: 'al-nour',
  address: null,
  postCode: null,
  city: null,
  isActive: true,
  ...over,
})

describe('createSchool', () => {
  let gateway: SchoolGatewaySpy

  beforeEach(() => {
    gateway = new SchoolGatewaySpy()
  })

  it('rejects an empty name', async () => {
    expect(await createSchool({ name: '', slug: 'ok' }, asGateway(gateway))).toBe('validationError')
  })

  it('rejects a slug that is not url-safe', async () => {
    expect(await createSchool({ name: 'École', slug: 'Pas Un Slug' }, asGateway(gateway))).toBe(
      'validationError'
    )
    expect(gateway.createCalls).toEqual([])
  })

  it('refuses a slug already taken', async () => {
    gateway.schools = [stored()]

    expect(await createSchool({ name: 'Autre', slug: 'al-nour' }, asGateway(gateway))).toBe(
      'slugAlreadyUsed'
    )
    expect(gateway.createCalls).toEqual([])
  })

  it('refuses a slug already taken by a deactivated school', async () => {
    gateway.schools = [stored({ isActive: false })]

    expect(await createSchool({ name: 'Autre', slug: 'al-nour' }, asGateway(gateway))).toBe(
      'slugAlreadyUsed'
    )
  })

  it('creates the school with its optional address fields', async () => {
    const result = await createSchool(
      { name: 'Horizon', slug: 'horizon', city: 'Paris' },
      asGateway(gateway)
    )

    expect(result).not.toBe('slugAlreadyUsed')
    expect(gateway.createCalls).toEqual([{ name: 'Horizon', slug: 'horizon', city: 'Paris' }])
  })
})

describe('updateSchool', () => {
  let gateway: SchoolGatewaySpy

  beforeEach(() => {
    gateway = new SchoolGatewaySpy()
    gateway.schools = [stored()]
  })

  it('fails when the school does not exist', async () => {
    expect(await updateSchool({ id: MISSING_ID, name: 'X', slug: 'x' }, asGateway(gateway))).toBe(
      'notFound'
    )
  })

  it('refuses a slug held by another school', async () => {
    gateway.schools.push(stored({ id: OTHER_ID, slug: 'horizon', name: 'Horizon' }))

    expect(
      await updateSchool({ id: SCHOOL_ID, name: 'Al-Nour', slug: 'horizon' }, asGateway(gateway))
    ).toBe('slugAlreadyUsed')
    expect(gateway.updateCalls).toEqual([])
  })

  it('accepts the school keeping its own slug', async () => {
    expect(
      await updateSchool({ id: SCHOOL_ID, name: 'Al-Nour 2', slug: 'al-nour' }, asGateway(gateway))
    ).toBe('OK')
    expect(gateway.updateCalls).toEqual([
      { id: SCHOOL_ID, data: { name: 'Al-Nour 2', slug: 'al-nour' } },
    ])
  })

  it('reaches a deactivated school, since editing must stay possible before reactivation', async () => {
    gateway.schools = [stored({ isActive: false })]

    expect(
      await updateSchool({ id: SCHOOL_ID, name: 'Al-Nour', slug: 'al-nour' }, asGateway(gateway))
    ).toBe('OK')
  })
})

describe('deactivateSchool', () => {
  let gateway: SchoolGatewaySpy

  beforeEach(() => {
    gateway = new SchoolGatewaySpy()
    gateway.schools = [stored()]
  })

  it('rejects an invalid id', async () => {
    expect(await deactivateSchool({ id: 'nope' }, asGateway(gateway))).toEqual({
      status: 'validationError',
    })
  })

  it('fails when the school does not exist', async () => {
    expect(await deactivateSchool({ id: MISSING_ID }, asGateway(gateway))).toEqual({
      status: 'notFound',
    })
    expect(gateway.deactivateCalls).toEqual([])
  })

  it('is a no-op on an already deactivated school', async () => {
    gateway.schools = [stored({ isActive: false })]

    expect(await deactivateSchool({ id: SCHOOL_ID }, asGateway(gateway))).toEqual({
      status: 'alreadyInactive',
    })
    expect(gateway.deactivateCalls).toEqual([])
  })

  it('propagates the last-active-school refusal decided inside the transaction', async () => {
    gateway.deactivateResult = { status: 'lastActiveSchool' }

    expect(await deactivateSchool({ id: SCHOOL_ID }, asGateway(gateway))).toEqual({
      status: 'lastActiveSchool',
    })
  })

  it('propagates the enumerated blockers', async () => {
    gateway.deactivateResult = {
      status: 'schoolInUse',
      blockers: { pendingEnrollments: 2, pendingTransactions: 0, pendingInvitations: 1 },
    }

    expect(await deactivateSchool({ id: SCHOOL_ID }, asGateway(gateway))).toEqual({
      status: 'schoolInUse',
      blockers: { pendingEnrollments: 2, pendingTransactions: 0, pendingInvitations: 1 },
    })
  })

  it('deactivates an eligible school', async () => {
    expect(await deactivateSchool({ id: SCHOOL_ID }, asGateway(gateway))).toEqual({ status: 'OK' })
    expect(gateway.deactivateCalls).toEqual([SCHOOL_ID])
  })
})

describe('reactivateSchool', () => {
  let gateway: SchoolGatewaySpy

  beforeEach(() => {
    gateway = new SchoolGatewaySpy()
    gateway.schools = [stored({ isActive: false })]
  })

  it('fails when the school does not exist', async () => {
    expect(await reactivateSchool({ id: MISSING_ID }, asGateway(gateway))).toBe('notFound')
  })

  it('is a no-op on an already active school', async () => {
    gateway.schools = [stored()]

    expect(await reactivateSchool({ id: SCHOOL_ID }, asGateway(gateway))).toBe('alreadyActive')
    expect(gateway.reactivateCalls).toEqual([])
  })

  it('reactivates a deactivated school', async () => {
    expect(await reactivateSchool({ id: SCHOOL_ID }, asGateway(gateway))).toBe('OK')
    expect(gateway.reactivateCalls).toEqual([SCHOOL_ID])
  })
})
