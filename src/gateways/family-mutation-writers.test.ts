import { beforeEach, describe, expect, it, vi } from 'vitest'

const tx = {
  $queryRaw: vi.fn(),
  person: { create: vi.fn(), update: vi.fn() },
  familyPerson: { create: vi.fn() },
  userFamily: { create: vi.fn(), deleteMany: vi.fn() },
}
vi.mock('@/lib/db', () => ({
  db: { $transaction: (fn: (client: typeof tx) => unknown) => fn(tx) },
  dbArchived: { $transaction: (fn: (client: typeof tx) => unknown) => fn(tx) },
}))
const { personGateway } = await import('./person-gateway')
const { familyGateway } = await import('./family-gateway')
const { userGateway } = await import('./user-gateway')

describe('family relation writers', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    tx.$queryRaw.mockResolvedValue([])
  })

  it('does not create an orphan person when the family is unavailable', async () => {
    expect(
      await personGateway.createWithFamily('school', 'family', 'PARENT', {
        name: 'Jane',
        lastname: 'Doe',
      })
    ).toBeNull()
    expect(tx.person.create).not.toHaveBeenCalled()
  })

  it('does not update a person when the family is unavailable', async () => {
    expect(
      await personGateway.updateWithFamily('school', 'family', 'person', {
        person: { name: 'Jane' },
        relationType: 'PARENT',
      })
    ).toBeNull()
    expect(tx.person.update).not.toHaveBeenCalled()
  })

  it('does not create or delete links to an unavailable family', async () => {
    expect(await familyGateway.linkUser('school', 'user', 'family')).toBeNull()
    expect(await familyGateway.addPerson('school', 'family', 'person', 'PARENT')).toBeNull()
    expect(await userGateway.linkFamily('user', 'family', 'school')).toBeNull()
    expect(await userGateway.unlinkFamily('user', 'family', 'school')).toBeNull()
    expect(tx.userFamily.create).not.toHaveBeenCalled()
    expect(tx.userFamily.deleteMany).not.toHaveBeenCalled()
    expect(tx.familyPerson.create).not.toHaveBeenCalled()
  })
})
