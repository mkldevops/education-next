import { describe, expect, it } from 'vitest'
import {
  findTenantViolation,
  reportTenantViolation,
  TenantScopeError,
  tenantGuardMode,
} from '@/lib/tenant-guard'

/**
 * Le garde doit être testé ici, en unité.
 *
 * Les tests de use-cases remplacent `@/lib/db` en entier
 * (`vi.mock('@/lib/db', () => ({ db: dbMock }))`), donc ils ne traversent jamais
 * l'extension Prisma : aucun test d'intégration existant ne couvrirait ce code.
 */
describe('findTenantViolation', () => {
  it('ignore les modèles plateforme', () => {
    expect(findTenantViolation('User', 'findMany', { where: {} })).toBeNull()
    expect(findTenantViolation('Session', 'findMany', { where: {} })).toBeNull()
    expect(
      findTenantViolation('PaymentProviderEvent', 'findUnique', { where: { id: 'x' } })
    ).toBeNull()
  })

  it('ignore SchoolMember, table de découverte lue avant toute école', () => {
    expect(findTenantViolation('SchoolMember', 'findMany', { where: { userId: 'u1' } })).toBeNull()
  })

  it('rejette une lecture racine sans scope', () => {
    expect(findTenantViolation('Family', 'findMany', { where: { isActive: true } })).toEqual({
      model: 'Family',
      operation: 'findMany',
      reason: 'missingScopeInWhere',
    })
  })

  it('rejette une lecture sans aucun where', () => {
    expect(findTenantViolation('Family', 'findMany', {})?.reason).toBe('missingScopeInWhere')
    expect(findTenantViolation('Family', 'findMany', undefined)?.reason).toBe('missingScopeInWhere')
  })

  it('accepte un schoolId direct', () => {
    expect(findTenantViolation('Family', 'findMany', { where: { schoolId: 's1' } })).toBeNull()
  })

  it('accepte les formes equals et in', () => {
    expect(
      findTenantViolation('Family', 'findFirst', { where: { schoolId: { equals: 's1' } } })
    ).toBeNull()
    // La forme `in` est requise par la résolution des liens profonds du lot 3.
    expect(
      findTenantViolation('Family', 'findFirst', {
        where: { id: 'f1', schoolId: { in: ['s1', 's2'] } },
      })
    ).toBeNull()
  })

  it('refuse un schoolId vide ou un in vide', () => {
    expect(findTenantViolation('Family', 'findMany', { where: { schoolId: '' } })?.reason).toBe(
      'missingScopeInWhere'
    )
    expect(
      findTenantViolation('Family', 'findMany', { where: { schoolId: { in: [] } } })?.reason
    ).toBe('missingScopeInWhere')
  })

  it('accepte les sélecteurs uniques composés générés', () => {
    expect(
      findTenantViolation('Family', 'findUnique', {
        where: { id_schoolId: { id: 'f1', schoolId: 's1' } },
      })
    ).toBeNull()
    expect(
      findTenantViolation('Config', 'findUnique', {
        where: { schoolId_name: { schoolId: 's1', name: 'logo_url' } },
      })
    ).toBeNull()
    expect(
      findTenantViolation('Student', 'findUnique', {
        where: { personId_schoolId: { personId: 'p1', schoolId: 's1' } },
      })
    ).toBeNull()
  })

  it('rejette un findUnique par id seul, que le typage autorise pourtant', () => {
    // `AtLeast<..., 'id' | 'id_schoolId'>` accepte `{ id }` : c'est bien le garde,
    // et non le compilateur, qui interdit cette forme.
    expect(findTenantViolation('Family', 'findUnique', { where: { id: 'f1' } })?.reason).toBe(
      'missingScopeInWhere'
    )
  })

  it('traverse un AND de premier niveau', () => {
    expect(
      findTenantViolation('Enrollment', 'findMany', {
        where: { AND: [{ status: 'ACTIVE' }, { schoolId: 's1' }] },
      })
    ).toBeNull()
  })

  it('exige schoolId à la création', () => {
    expect(findTenantViolation('Family', 'create', { data: { name: 'Dupont' } })?.reason).toBe(
      'missingScopeInData'
    )
    expect(
      findTenantViolation('Family', 'create', { data: { name: 'Dupont', schoolId: 's1' } })
    ).toBeNull()
  })

  it('accepte school.connect à la création', () => {
    expect(
      findTenantViolation('Family', 'create', {
        data: { name: 'Dupont', school: { connect: { id: 's1' } } },
      })
    ).toBeNull()
  })

  it('exige schoolId sur chaque ligne d un createMany', () => {
    expect(
      findTenantViolation('Payment', 'createMany', {
        data: [{ amount: 10, schoolId: 's1' }, { amount: 20 }],
      })?.reason
    ).toBe('missingScopeInData')
    expect(
      findTenantViolation('Payment', 'createMany', {
        data: [
          { amount: 10, schoolId: 's1' },
          { amount: 20, schoolId: 's1' },
        ],
      })
    ).toBeNull()
  })

  it('exige where et create sur un upsert', () => {
    expect(
      findTenantViolation('Config', 'upsert', {
        where: { id: 'c1' },
        create: { name: 'x', schoolId: 's1' },
        update: {},
      })?.reason
    ).toBe('missingScopeInWhere')

    expect(
      findTenantViolation('Config', 'upsert', {
        where: { schoolId_name: { schoolId: 's1', name: 'x' } },
        create: { name: 'x' },
        update: {},
      })?.reason
    ).toBe('missingScopeInData')

    expect(
      findTenantViolation('Config', 'upsert', {
        where: { schoolId_name: { schoolId: 's1', name: 'x' } },
        create: { name: 'x', schoolId: 's1' },
        update: { value: 'v' },
      })
    ).toBeNull()
  })

  it("interdit de réaffecter l'école d'une ligne existante", () => {
    expect(
      findTenantViolation('Family', 'update', {
        where: { id_schoolId: { id: 'f1', schoolId: 's1' } },
        data: { schoolId: 's2' },
      })?.reason
    ).toBe('tenantReassignment')
  })

  it('interdit la réaffectation par la relation school, pas seulement par schoolId', () => {
    expect(
      findTenantViolation('Family', 'update', {
        where: { id_schoolId: { id: 'f1', schoolId: 's1' } },
        data: { school: { connect: { id: 's2' } } },
      })?.reason
    ).toBe('tenantReassignment')

    expect(
      findTenantViolation('Config', 'upsert', {
        where: { schoolId_name: { schoolId: 's1', name: 'x' } },
        create: { name: 'x', schoolId: 's1' },
        update: { school: { connect: { id: 's2' } } },
      })?.reason
    ).toBe('tenantReassignment')
  })

  it('couvre les écritures de masse et les suppressions', () => {
    expect(findTenantViolation('Payment', 'deleteMany', { where: {} })?.reason).toBe(
      'missingScopeInWhere'
    )
    expect(findTenantViolation('Payment', 'updateMany', { where: {}, data: {} })?.reason).toBe(
      'missingScopeInWhere'
    )
    expect(findTenantViolation('Payment', 'aggregate', { where: { schoolId: 's1' } })).toBeNull()
    expect(findTenantViolation('Payment', 'groupBy', { where: { schoolId: 's1' } })).toBeNull()
  })

  it.each(['AttendanceSession', 'AttendanceEntry'])('scope le modèle de présence %s', (model) => {
    expect(findTenantViolation(model, 'findMany', { where: { id: 'a1' } })?.reason).toBe(
      'missingScopeInWhere'
    )
    expect(
      findTenantViolation(model, 'updateMany', { where: { id: 'a1' }, data: {} })?.reason
    ).toBe('missingScopeInWhere')
    expect(findTenantViolation(model, 'create', { data: { id: 'a1' } })?.reason).toBe(
      'missingScopeInData'
    )
    expect(
      findTenantViolation(model, 'updateMany', {
        where: { id: 'a1', schoolId: 's1' },
        data: { schoolId: 's2' },
      })?.reason
    ).toBe('tenantReassignment')
    expect(findTenantViolation(model, 'findMany', { where: { schoolId: 's1' } })).toBeNull()
    expect(
      findTenantViolation(model, 'deleteMany', { where: { id: 'a1', schoolId: 's1' } })
    ).toBeNull()
  })

  it('accepte le sélecteur composé de la séance de présence', () => {
    expect(
      findTenantViolation('AttendanceSession', 'findUnique', {
        where: {
          schoolId_classPeriodId_occurredOn_occurrenceKey: {
            schoolId: 's1',
            classPeriodId: 'c1',
            occurredOn: new Date('2026-09-23'),
            occurrenceKey: 'adhoc',
          },
        },
      })
    ).toBeNull()
    expect(
      findTenantViolation('AttendanceSession', 'findUnique', {
        where: { id_schoolId: { id: 'a1', schoolId: 's1' } },
      })
    ).toBeNull()
  })
})

describe('reportTenantViolation', () => {
  const violation = {
    model: 'Family',
    operation: 'findMany',
    reason: 'missingScopeInWhere',
  } as const

  it('lève en mode throw', () => {
    expect(() => reportTenantViolation(violation, 'throw')).toThrow(TenantScopeError)
    expect(() => reportTenantViolation(violation, 'throw')).toThrow(/Family\.findMany/)
  })

  it('laisse passer en mode warn et off', () => {
    expect(() => reportTenantViolation(violation, 'warn')).not.toThrow()
    expect(() => reportTenantViolation(violation, 'off')).not.toThrow()
  })
})

describe('tenantGuardMode', () => {
  it('vaut throw par défaut et accepte les trois modes', () => {
    const previous = process.env.TENANT_GUARD_MODE

    process.env.TENANT_GUARD_MODE = undefined
    delete process.env.TENANT_GUARD_MODE
    expect(tenantGuardMode()).toBe('throw')

    process.env.TENANT_GUARD_MODE = 'warn'
    expect(tenantGuardMode()).toBe('warn')

    process.env.TENANT_GUARD_MODE = 'off'
    expect(tenantGuardMode()).toBe('off')

    process.env.TENANT_GUARD_MODE = 'nonsense'
    expect(tenantGuardMode()).toBe('throw')

    if (previous === undefined) {
      delete process.env.TENANT_GUARD_MODE
    } else {
      process.env.TENANT_GUARD_MODE = previous
    }
  })
})
