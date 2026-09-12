import type { z } from 'zod'
import { checkCapacity } from '@/domain/class-period'
import { calculateTotalAmount, validateDiscount } from '@/domain/enrollment'
import { validateFamilyName } from '@/domain/family'
import { draftExpiry, type McpFinding } from '@/domain/mcp-draft'
import { distributePayment } from '@/domain/payment'
import { validateStudentBirthday } from '@/domain/student'
import { classPeriodGateway } from '@/gateways/class-period-gateway'
import { familyGateway } from '@/gateways/family-gateway'
import { mcpDraftGateway } from '@/gateways/mcp-draft-gateway'
import { mcpReadGateway } from '@/gateways/mcp-read-gateway'
import { paymentGateway } from '@/gateways/payment-gateway'
import { personGateway } from '@/gateways/person-gateway'
import { draftChecksum } from '@/lib/mcp-draft-crypto'
import type { McpScope } from './resolve-mcp-scope'
import { previewEnrollFamilySchema } from './schemas'

// `z.input`, pas `z.infer` : l'entrée vient d'un modèle et traverse le schéma — un défaut
// y est absent.
type Input = z.input<typeof previewEnrollFamilySchema>

export const ENROLL_FAMILY_TOOL = 'enroll_family'

/**
 * Résolution d'un libellé lu sur papier. L'égalité insensible à la casse d'abord, puis
 * une seule passe par sous-chaîne : « C4 » doit atteindre « C4 — Arabe débutant », mais
 * deux candidats restants sont une ambiguïté à rendre à l'humain, pas à trancher.
 */
function matchByName<T extends { name: string }>(rows: T[], label: string): T[] {
  const wanted = label.trim().toLowerCase()
  const exact = rows.filter((row) => row.name.trim().toLowerCase() === wanted)
  if (exact.length > 0) return exact
  return rows.filter((row) => row.name.toLowerCase().includes(wanted))
}

export async function previewEnrollFamily(scope: McpScope, input: Input) {
  const parsed = previewEnrollFamilySchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId } = scope
  const data = parsed.data

  const blockers: McpFinding[] = []
  const warnings: McpFinding[] = []

  if (validateFamilyName(data.familyName) !== 'OK') {
    blockers.push({ field: 'familyName', value: data.familyName, reason: 'invalidFamilyName' })
  }

  for (const [index, student] of data.students.entries()) {
    if (validateStudentBirthday(new Date(student.birthday)) !== 'OK') {
      blockers.push({
        field: `students.${index}.birthday`,
        value: student.birthday,
        reason: 'birthdayNotInThePast',
      })
    }
  }

  const [classPeriods, plans] = await Promise.all([
    mcpReadGateway.listClassPeriods(schoolId),
    mcpReadGateway.listPlans(schoolId),
  ])

  // Une classe par élève : la fratrie se répartit couramment sur plusieurs classes, et
  // l'échec de résolution doit nommer l'enfant concerné, pas la famille entière.
  const studentClasses = data.students.map((student, index) => {
    const matches = matchByName(classPeriods, student.className)
    if (matches.length === 1) return matches[0]

    blockers.push({
      field: `students.${index}.className`,
      value: student.className,
      reason: matches.length === 0 ? 'unknownClass' : 'ambiguousClass',
    })
    return null
  })

  const planMatches = matchByName(plans, data.planName)
  if (planMatches.length !== 1) {
    blockers.push({
      field: 'planName',
      value: data.planName,
      reason: planMatches.length === 0 ? 'unknownPlan' : 'ambiguousPlan',
    })
  }

  const plan = planMatches.length === 1 ? planMatches[0] : null
  const planAmount = plan ? Number(plan.amount) : 0

  if (plan && validateDiscount(planAmount, data.discount) !== 'OK') {
    blockers.push({
      field: 'discount',
      value: String(data.discount),
      reason: 'discountExceedsPlan',
    })
  }

  const totalAmount = calculateTotalAmount(planAmount, data.discount)

  // La capacité se juge par classe visée, pas par fratrie : deux enfants en C4 et un en
  // C2 ne prennent pas trois places en C4. Le commit refait ce compte dans sa
  // transaction, seul endroit où il fait autorité.
  const seatsWanted = new Map<string, number>()
  for (const classPeriod of studentClasses) {
    if (classPeriod) seatsWanted.set(classPeriod.id, (seatsWanted.get(classPeriod.id) ?? 0) + 1)
  }

  const seatChecks = await Promise.all(
    [...seatsWanted].map(async ([id, wanted]) => {
      const classPeriod = classPeriods.find((row) => row.id === id)
      if (!classPeriod) return null

      // `checkCapacity` répond pour une place : on lui présente la classe une fois les
      // premiers élèves assis, donc `wanted - 1` en plus.
      const enrolled = await classPeriodGateway.countEnrolled(schoolId, id)
      return checkCapacity(classPeriod.capacity, enrolled + wanted - 1) === 'OK' ? null : id
    })
  )

  // Un blocage par enfant de la classe pleine, au chemin de son champ : l'agent corrige
  // un élève, et aucun enfant de la classe n'est plus en trop qu'un autre.
  const fullClasses = new Set(seatChecks.filter((id) => id !== null))
  for (const [index, classPeriod] of studentClasses.entries()) {
    if (!classPeriod || !fullClasses.has(classPeriod.id)) continue

    blockers.push({
      field: `students.${index}.className`,
      value: data.students[index].className,
      reason: 'classFull',
    })
  }

  // La répartition est calculée ici, pas au commit : les inscriptions n'existent pas
  // encore, donc elle est indexée sur la position de l'élève dans la demande.
  let allocation: Array<{ studentIndex: number; amount: number }> = []
  if (data.payment && plan) {
    const distribution = distributePayment(
      data.payment.amount,
      data.students.map((_, index) => ({
        enrollmentId: String(index),
        totalAmount,
        discount: data.discount,
        remainingBalance: totalAmount,
      }))
    )

    if (distribution.result === 'OK') {
      allocation = distribution.distribution.map((item) => ({
        studentIndex: Number(item.enrollmentId),
        amount: item.amount,
      }))
    } else {
      blockers.push({
        field: 'payment.amount',
        value: String(data.payment.amount),
        reason: distribution.result,
      })
    }
  }

  const familyMatches = await familyGateway.searchByName(schoolId, data.familyName)
  const personMatches = await Promise.all(
    data.students.map((student) =>
      personGateway.searchByName(schoolId, student.name, student.lastname)
    )
  )

  for (const match of familyMatches) {
    warnings.push({ field: 'familyName', value: match.name, reason: 'existingFamily' })
  }

  for (const [index, matches] of personMatches.entries()) {
    for (const match of matches) {
      warnings.push({
        field: `students.${index}`,
        value: `${match.name} ${match.lastname}`,
        reason: match.student ? 'existingStudent' : 'existingPerson',
      })
    }
  }

  if (data.payment?.reference) {
    const sameReference = await paymentGateway.findByReference(schoolId, data.payment.reference)
    if (sameReference.length > 0) {
      warnings.push({
        field: 'payment.reference',
        value: data.payment.reference,
        reason: 'referenceAlreadyUsed',
      })
    }
  }

  // La surface publiée est décidée ici, pas héritée des gateways du dashboard : ces lignes
  // partent dans le contexte du fournisseur de modèle, et un homonyme n'a besoin que d'un nom
  // et du drapeau « déjà élève ». Une colonne ajoutée plus tard à `Person` ou `Student` ne peut
  // pas la suivre sans passer par ce `map`.
  const matches = {
    families: familyMatches.map((row) => ({ id: row.id, name: row.name })),
    students: personMatches.flat().map((row) => ({
      id: row.id,
      name: row.name,
      lastname: row.lastname,
      isStudent: row.student !== null,
    })),
  }

  // Chaque élève emporte sa classe dans le même élément : un filtre suivi d'un accès par
  // index désalignerait élèves et classes au premier élève non résolu.
  const students = data.students.flatMap(({ className, ...student }, index) => {
    const classPeriod = studentClasses[index]
    if (!classPeriod) return []

    return [
      {
        ...student,
        birthday: new Date(student.birthday).toISOString(),
        classPeriod: { id: classPeriod.id, name: classPeriod.name },
      },
    ]
  })

  if (blockers.length > 0 || !plan || students.length !== data.students.length) {
    return { draftId: null, checksum: null, plan: null, matches, warnings, blockers }
  }

  const resolved = {
    tool: ENROLL_FAMILY_TOOL,
    family: {
      name: data.familyName,
      emergencyContactName: data.emergencyContactName,
      emergencyContactPhone: data.emergencyContactPhone,
      createdById: scope.userId,
    },
    parents: data.parents,
    students,
    plan: { id: plan.id, name: plan.name, amount: planAmount },
    discount: data.discount,
    totalAmount,
    payment: data.payment
      ? {
          amount: data.payment.amount,
          method: data.payment.method,
          reference: data.payment.reference,
          paidAt: new Date(data.payment.paidAt).toISOString(),
          cashedAt: data.payment.cashedAt
            ? new Date(data.payment.cashedAt).toISOString()
            : undefined,
          allocation,
        }
      : null,
  }

  const checksum = draftChecksum(resolved)
  const draft = await mcpDraftGateway.create(schoolId, {
    keyId: scope.keyId,
    tool: ENROLL_FAMILY_TOOL,
    checksum,
    resolved,
    expiresAt: draftExpiry(),
  })

  return { draftId: draft.id, checksum, plan: resolved, matches, warnings, blockers }
}
