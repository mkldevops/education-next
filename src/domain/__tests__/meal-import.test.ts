import { describe, expect, it } from 'vitest'
import { mealImportManifestSchema } from '@/use-cases/meals/schemas'
import {
  type MealImportLine,
  type MealImportStudent,
  mealImportAccountKey,
  mealImportCoverageLines,
  mealImportOpeningReason,
  planMealImport,
  splitFamilyCodes,
  summarizeMealImport,
} from '../meal-import'

const context = {
  constatDate: '2026-10-30',
  periodEnd: '2027-06-30',
  usualWeekdays: [1, 2, 3, 4, 5],
  allowedWeekdays: { CANTEEN: [1, 2, 3, 4, 5], SNACK: [1, 2, 3, 4, 5] },
  isClosed: (day: string) => ['2026-10-05', '2026-10-06'].includes(day),
}

const line = (over: Partial<MealImportLine> = {}): MealImportLine => ({
  service: 'CANTEEN',
  className: 'CP',
  lastname: 'DOE',
  name: 'ANA',
  weekdays: 'usual',
  startOn: '2026-10-05',
  coverage: { state: 'unknown', piece: 'date' },
  ...over,
})

const student = (over: Partial<MealImportStudent> = {}): MealImportStudent => ({
  id: 'student-1',
  lastname: 'Doe',
  name: 'Ana',
  className: 'CP',
  families: [{ familyId: 'family-1', relationType: 'PARENT' }],
  ...over,
})

type Account = NonNullable<ReturnType<Parameters<typeof planMealImport>[2]['get']>>

const emptyAccount: Account = { segments: [], openings: [], payments: [] }
const segment = { weekdays: [1, 2, 3, 4, 5], startOn: '2026-10-05', endOn: null }
const key = mealImportAccountKey('student-1', 'CANTEEN')
const paid = { state: 'paid', paidThrough: '2026-10-09' } as const
const reason = mealImportOpeningReason('2026-10-30', '2026-10-09')

describe('planMealImport', () => {
  it('links a line to the student and debtor family and skips closed days in the opening', () => {
    const [decision] = planMealImport(
      [line({ lastname: 'DOÉ', name: 'ANA', coverage: paid })],
      [
        student({
          families: [
            { familyId: 'family-2', relationType: 'OTHER' },
            { familyId: 'family-1', relationType: 'PARENT' },
          ],
        }),
      ],
      new Map(),
      context
    )

    expect(decision?.identity).toMatchObject({
      status: 'resolved',
      studentId: 'student-1',
      familyId: 'family-1',
    })
    expect(decision?.subscription).toBe('create')
    expect(decision?.opening).toEqual({ status: 'create', days: 3, reason })
    expect(decision?.ready).toBe(true)
  })

  it('counts only the checked weekdays of a partial rhythm', () => {
    const [decision] = planMealImport(
      [line({ weekdays: [2, 4], coverage: paid })],
      [student()],
      new Map(),
      context
    )

    expect(decision?.weekdays).toEqual([2, 4])
    expect(decision?.opening).toMatchObject({ status: 'create', days: 1 })
  })

  it('reads hyphen and underscore spellings as the same name, not proximity', () => {
    const [underscore, typo] = planMealImport(
      [line({ name: 'AN_NA' }), line({ service: 'SNACK', name: 'ANNA' })],
      [student({ name: 'An-Na' })],
      new Map(),
      context
    )

    expect(underscore?.identity.status).toBe('resolved')
    expect(typo?.identity.status).toBe('unknown')
    expect(typo?.subscription).toBe('blocked')
  })

  it('uses an explicit alias and reports how the line was matched', () => {
    const [decision] = planMealImport(
      [line({ lastname: 'DOEE', aliases: [{ lastname: 'DOE', name: 'ANA' }] })],
      [student()],
      new Map(),
      context
    )

    expect(decision?.identity).toMatchObject({ status: 'resolved', via: 'alias' })
  })

  it('isolates homonyms and children without family while other lines proceed', () => {
    const decisions = planMealImport(
      [line(), line({ lastname: 'ROE' }), line({ lastname: 'POE' })],
      [
        student(),
        student({ id: 'student-2' }),
        student({ id: 'student-3', lastname: 'Roe', families: [] }),
        student({ id: 'student-4', lastname: 'Poe' }),
      ],
      new Map(),
      context
    )

    expect(decisions.map((item) => item.identity.status)).toEqual([
      'ambiguous',
      'noFamily',
      'resolved',
    ])
  })

  it('refuses two lines of the same service for one child', () => {
    const decisions = planMealImport([line(), line()], [student()], new Map(), context)

    expect(decisions.map((item) => item.identity.status)).toEqual(['duplicate', 'duplicate'])
  })

  it('keeps a held line unsubscribed, and never as ready', () => {
    const [decision] = planMealImport(
      [line({ hold: 'début à confirmer', coverage: paid })],
      [student()],
      new Map(),
      context
    )

    expect(decision?.subscription).toBe('held')
    expect(decision?.opening.status).toBe('pending')
    expect(decision?.ready).toBe(false)
  })

  it('rejects weekdays the school does not allow', () => {
    const [decision] = planMealImport([line({ weekdays: [6] })], [student()], new Map(), context)

    expect(decision?.subscription).toBe('invalidWeekdays')
  })

  it('is idempotent on a replay: same segment and same opening write nothing', () => {
    const accounts = new Map([
      [key, { ...emptyAccount, segments: [segment], openings: [{ days: 3, reason }] }],
    ])
    const [decision] = planMealImport([line({ coverage: paid })], [student()], accounts, context)

    expect(decision?.subscription).toBe('present')
    expect(decision?.opening).toEqual({ status: 'present', days: 3, reason })
    expect(decision?.ready).toBe(true)
  })

  it('leaves a different existing rhythm untouched and postpones its opening', () => {
    const accounts = new Map([
      [key, { ...emptyAccount, segments: [{ ...segment, weekdays: [1] }] }],
    ])
    const [decision] = planMealImport([line({ coverage: paid })], [student()], accounts, context)

    expect(decision?.subscription).toBe('conflict')
    expect(decision?.opening.status).toBe('pending')
  })

  it('never replaces an opening recorded differently', () => {
    const accounts = new Map([
      [
        key,
        {
          ...emptyAccount,
          segments: [segment],
          openings: [{ days: 9, reason: 'Cahier' }],
        },
      ],
    ])
    const [decision] = planMealImport([line({ coverage: paid })], [student()], accounts, context)

    expect(decision?.opening.status).toBe('conflict')
    expect(decision?.ready).toBe(false)
  })

  it('holds the opening of an account with a payment already recorded', () => {
    const accounts = new Map([
      [
        key,
        {
          ...emptyAccount,
          segments: [segment],
          payments: [{ amount: 3000, daysAdded: 4, on: '2026-10-31' }],
        },
      ],
    ])
    const [decision] = planMealImport([line({ coverage: paid })], [student()], accounts, context)

    expect(decision?.opening).toMatchObject({
      status: 'reconcile',
      detail: '2026-10-31 3000 (4 j.)',
    })
    expect(decision?.ready).toBe(false)
  })

  it('does not call unknown coverage ready, and flags a recorded payment', () => {
    const accounts = new Map([
      [
        key,
        {
          ...emptyAccount,
          payments: [{ amount: 500, daysAdded: 1, on: '2026-10-31' }],
        },
      ],
    ])
    const [decision] = planMealImport([line()], [student()], accounts, context)

    expect(decision?.ready).toBe(false)
    expect(decision?.warnings).toContain('1 encaissement(s) déjà saisi(s) à rapprocher')
  })

  it('reports a class difference without blocking the subscription', () => {
    const [decision] = planMealImport(
      [line({ className: 'MS' })],
      [student({ className: 'GS' })],
      new Map(),
      context
    )

    expect(decision?.subscription).toBe('create')
    expect(decision?.warnings).toEqual(['classe source MS, base GS : inchangée'])
  })

  it('ignores a paid-through date before the first served day', () => {
    const [decision] = planMealImport(
      [line({ coverage: { state: 'paid', paidThrough: '2026-09-30' } })],
      [student()],
      new Map(),
      context
    )

    expect(decision?.opening.status).toBe('none')
  })
})

describe('coverage of an imported account', () => {
  const uncertain = {
    state: 'uncertain',
    piece: 'date en marge',
    proposedPaidThrough: '2026-10-09',
  } as const
  const unpaid = { state: 'unpaid' } as const
  const plan = (coverage: MealImportLine['coverage'], account = emptyAccount) =>
    planMealImport([line({ coverage })], [student()], new Map([[key, account]]), context)

  it('confirms a paid coverage controlled by the school and records its opening', () => {
    const [decision] = plan(paid)

    expect(decision?.opening.status).toBe('create')
    expect(decision?.ready).toBe(true)
    expect(decision?.balance).toBe('confirmed')
  })

  it('writes no opening from a provisional date and keeps the proposal on the line', () => {
    const [decision] = plan(uncertain)

    expect(decision?.opening).toEqual({ status: 'none' })
    expect(decision?.ready).toBe(false)
    expect(decision?.balance).toBe('toReconcile')
    expect(decision?.line.coverage).toEqual(uncertain)
  })

  it('confirms an explicit unpaid state without opening, debt or credit', () => {
    const [decision] = plan(unpaid)

    expect(decision?.opening).toEqual({ status: 'none' })
    expect(decision?.ready).toBe(true)
    expect(decision?.balance).toBe('confirmed')
  })

  it('leaves an unknown coverage to reconcile', () => {
    const [decision] = plan({ state: 'unknown', piece: 'cahier' })

    expect(decision?.opening).toEqual({ status: 'none' })
    expect(decision?.balance).toBe('toReconcile')
  })

  it('does not confirm unpaid against a payment or an opening already recorded', () => {
    const payments = [{ amount: 3000, daysAdded: 4, on: '2026-10-31' }]
    const [withPayment] = plan(unpaid, { ...emptyAccount, payments })
    const [withOpening] = plan(unpaid, { ...emptyAccount, openings: [{ days: 3, reason }] })

    expect(withPayment?.balance).toBe('toReconcile')
    expect(withOpening?.balance).toBe('toReconcile')
    expect(withOpening?.warnings).toContain('ouverture déjà saisie à rapprocher')
  })

  it('leaves a recorded opening alone when its date becomes provisional', () => {
    const account = { ...emptyAccount, segments: [segment], openings: [{ days: 3, reason }] }
    const [decision] = plan(uncertain, account)

    expect(decision?.subscription).toBe('present')
    expect(decision?.opening).toEqual({ status: 'none' })
    expect(decision?.balance).toBe('toReconcile')
  })

  it('keeps the same totals on a replay, where subscriptions already exist', () => {
    const present = { ...emptyAccount, segments: [segment] }
    const lines = [
      line({ coverage: paid }),
      line({ lastname: 'ROE', coverage: uncertain }),
      line({ lastname: 'POE', coverage: unpaid }),
      line({ lastname: 'LOE', coverage: { state: 'unknown', piece: 'cahier' } }),
      line({ lastname: 'MOE', hold: 'début à confirmer', coverage: paid }),
    ]
    const students = ['1', '2', '3', '4', '5'].map((id, index) =>
      student({ id, lastname: ['Doe', 'Roe', 'Poe', 'Loe', 'Moe'][index] as string })
    )
    const first = planMealImport(lines, students, new Map(), context)
    const stored = new Map(
      ['2', '3', '4'].map((id) => [mealImportAccountKey(id, 'CANTEEN'), present])
    )
    stored.set(mealImportAccountKey('1', 'CANTEEN'), {
      ...present,
      openings: [{ days: 3, reason }],
    })
    const replay = planMealImport(lines, students, stored, context)

    expect(replay.map((item) => item.balance)).toEqual(first.map((item) => item.balance))
    expect(mealImportCoverageLines(replay)).toEqual(mealImportCoverageLines(first))
    expect(mealImportCoverageLines(first)).toEqual([
      'Couverture de 5 ligne(s) : 2 confirmée(s) (1 payée(s), 1 non payée(s)), ' +
        '2 inconnue(s) ou à rapprocher, 1 retenue(s).',
      'Un abonnement appliqué ne valide pas le solde : aucune dette, aucun crédit ' +
        'ni aucune exonération écrits, les comptes à rapprocher restent à contrôler par l’école.',
    ])
  })

  it('retains a line whose subscription cannot be planned', () => {
    const [decision] = planMealImport([line({ coverage: paid })], [], new Map(), context)

    expect(decision?.balance).toBe('retained')
  })

  it('keeps the proposed date of an uncertain line through the manifest schema', () => {
    const parsed = mealImportManifestSchema.parse({
      constatDate: '2026-10-30',
      requiredClosures: ['2026-10-05'],
      lines: [line({ coverage: uncertain })],
    })

    expect(parsed.lines[0]?.coverage).toEqual(uncertain)
  })
})

describe('summarizeMealImport', () => {
  it('counts each service separately and each child once', () => {
    const decisions = planMealImport(
      [
        line({ coverage: { state: 'unpaid' } }),
        line({ service: 'SNACK', water: true }),
        line({ lastname: 'ROE', hold: 'à confirmer' }),
      ],
      [student(), student({ id: 'student-2', lastname: 'Roe' })],
      new Map(),
      context
    )

    expect(summarizeMealImport(decisions)).toEqual({
      canteen: {
        target: 2,
        subscribable: 1,
        held: 1,
        blocked: 0,
        openings: 0,
        ready: 1,
        toReconcile: 0,
        retained: 1,
      },
      snack: {
        target: 1,
        subscribable: 1,
        held: 0,
        blocked: 0,
        openings: 0,
        ready: 0,
        toReconcile: 1,
        retained: 0,
      },
      distinctStudents: 2,
      water: 1,
    })
  })
})

describe('splitFamilyCodes', () => {
  it('flags an old family code spread over two debtor families', () => {
    const decisions = planMealImport(
      [line({ familyCode: 'F1' }), line({ lastname: 'ROE', familyCode: 'F1' })],
      [
        student(),
        student({
          id: 'student-2',
          lastname: 'Roe',
          families: [{ familyId: 'family-2', relationType: 'PARENT' }],
        }),
      ],
      new Map(),
      context
    )

    expect(splitFamilyCodes(decisions)).toEqual(['F1'])
  })
})
