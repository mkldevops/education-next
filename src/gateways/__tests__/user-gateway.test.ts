import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = { user: { findUnique: vi.fn(), count: vi.fn() } }
const dbArchivedMock = {
  user: { findUnique: vi.fn(), count: vi.fn(), update: vi.fn() },
  userFamily: { findFirst: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
}

vi.mock('@/lib/db', () => ({ db: dbMock, dbArchived: dbArchivedMock }))

// Import dynamique obligatoire : `vi.mock` est hoisté, mais sa factory est lazy.
// Même motif que `config-gateway.test.ts`.
const { userGateway } = await import('../user-gateway')

const SCHOOL = 'school-1'
const OTHER_SCHOOL = 'school-2'
const USER = 'IQIcCmrvISuDG9mVxlPh4ISuCj7bdZxw'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('userGateway.findDetail', () => {
  /**
   * Un administrateur d'école lisait, par les relations imbriquées, les familles et
   * les enfants des **autres** écoles d'un compte partagé entre plusieurs
   * établissements. La garde tenant ne peut pas l'attraper : elle n'inspecte que la
   * racine des requêtes. Le seul rempart est donc ce filtre, et ce test.
   */
  it('scopes the nested families to the active school', async () => {
    dbArchivedMock.user.findUnique.mockResolvedValue(null)

    await userGateway.findDetail(USER, SCHOOL)

    const { select } = dbArchivedMock.user.findUnique.mock.calls[0][0]
    expect(select.families.where).toEqual({ schoolId: SCHOOL })
  })

  it('scopes the nested invitations to the active school', async () => {
    dbArchivedMock.user.findUnique.mockResolvedValue(null)

    await userGateway.findDetail(USER, SCHOOL)

    const { select } = dbArchivedMock.user.findUnique.mock.calls[0][0]
    expect(select.createdInvitations.where).toEqual({ schoolId: SCHOOL })
  })

  /**
   * Les compteurs d'activité portent sur des modèles scopés : non filtrés, ils
   * révèlent l'activité d'une autre école — un nombre plutôt qu'un nom, mais la même
   * frontière franchie.
   */
  it('scopes the activity counters, and leaves the platform ones global', async () => {
    dbArchivedMock.user.findUnique.mockResolvedValue(null)

    await userGateway.findDetail(USER, SCHOOL)

    const { select } = dbArchivedMock.user.findUnique.mock.calls[0][0]
    expect(select._count.select.createdFamilies).toEqual({ where: { schoolId: SCHOOL } })
    expect(select._count.select.createdInvitations).toEqual({ where: { schoolId: SCHOOL } })
    expect(select._count.select.paymentTransactions).toEqual({ where: { schoolId: SCHOOL } })

    // `Session`, `Passkey` et `Account` n'appartiennent à aucune école.
    expect(select._count.select.sessions).toBe(true)
    expect(select._count.select.passkeys).toBe(true)
    expect(select._count.select.accounts).toBe(true)
  })
})

describe('userGateway family links', () => {
  /**
   * `UserFamily` est un modèle scopé, mais son unique composé est `userId_familyId` :
   * il ne porte pas `schoolId`, donc l'atteindre par `findUnique`/`delete` produit une
   * lecture que la garde signale. On passe par `findFirst`/`deleteMany` pour pouvoir
   * contraindre l'école.
   */
  it('reads a link scoped by school', async () => {
    dbArchivedMock.userFamily.findFirst.mockResolvedValue(null)

    await userGateway.hasFamilyLink(USER, 'family-1', SCHOOL)

    expect(dbArchivedMock.userFamily.findFirst).toHaveBeenCalledWith({
      where: { userId: USER, familyId: 'family-1', schoolId: SCHOOL },
      select: { userId: true },
    })
  })

  it('deletes a link scoped by school, so another school is untouched', async () => {
    dbArchivedMock.userFamily.deleteMany.mockResolvedValue({ count: 1 })

    await userGateway.unlinkFamily(USER, 'family-1', SCHOOL)

    const { where } = dbArchivedMock.userFamily.deleteMany.mock.calls[0][0]
    expect(where).toEqual({ userId: USER, familyId: 'family-1', schoolId: SCHOOL })
    expect(where.schoolId).not.toBe(OTHER_SCHOOL)
  })

  it('writes the school on creation, which the composite key requires', async () => {
    dbArchivedMock.userFamily.create.mockResolvedValue({})

    await userGateway.linkFamily(USER, 'family-1', SCHOOL)

    expect(dbArchivedMock.userFamily.create).toHaveBeenCalledWith({
      data: { userId: USER, familyId: 'family-1', schoolId: SCHOOL },
    })
  })
})

describe('userGateway.countGoogleOnlyAccounts', () => {
  /**
   * Le risque nommé par #265 : un compte qui tient un second identifiant (mot de passe,
   * un autre fournisseur) ne perd rien à la coupure de Google. Ce test échoue si la
   * requête cesse d'exclure ces comptes-là.
   */
  it('requires a google account and excludes any account holding a second identifier', async () => {
    dbMock.user.count.mockResolvedValue(0)

    await userGateway.countGoogleOnlyAccounts()

    const { where } = dbMock.user.count.mock.calls[0][0]
    expect(where.accounts.some).toEqual({ providerId: 'google' })
    expect(where.accounts.none).toEqual({ providerId: { not: 'google' } })
  })

  it('reads through db, not dbArchived, so a deactivated account is not counted', async () => {
    dbMock.user.count.mockResolvedValue(0)

    await userGateway.countGoogleOnlyAccounts()

    expect(dbArchivedMock.user.count).not.toHaveBeenCalled()
    expect(dbMock.user.count).toHaveBeenCalledTimes(1)
  })

  it('returns the count from the database', async () => {
    dbMock.user.count.mockResolvedValue(3)

    await expect(userGateway.countGoogleOnlyAccounts()).resolves.toBe(3)
  })
})
