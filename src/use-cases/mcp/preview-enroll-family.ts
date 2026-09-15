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
import { planGateway } from '@/gateways/plan-gateway'
import { draftChecksum } from '@/lib/mcp-draft-crypto'
import { matchByName } from './match-by-name'
import type { McpScope } from './resolve-mcp-scope'
import { previewEnrollFamilySchema } from './schemas'

// `z.input`, pas `z.infer` : l'entrée vient d'un modèle et traverse le schéma — un défaut
// y est absent.
type Input = z.input<typeof previewEnrollFamilySchema>

type Family = NonNullable<Awaited<ReturnType<typeof familyGateway.findMembersForMcp>>>
type Member = Family['persons'][number]['person']

export const ENROLL_FAMILY_TOOL = 'enroll_family'

type ResolvedStudent = {
  name: string
  lastname: string
  sex?: 'MALE' | 'FEMALE'
  birthday?: string
  birthplace?: string
  personId?: string
  studentId?: string
  classPeriod: { id: string; name: string }
  plan: { id: string; name: string; amount: number }
  totalAmount: number
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
const within = (a: string, b: string) => a.toLowerCase().includes(b.trim().toLowerCase())

/**
 * Un élève de la fiche retrouvé parmi les membres de la famille visée.
 *
 * Même règle que `matchByName` : l'égalité d'abord, puis la sous-chaîne — « Mouhammad »
 * atteint « Mouhammad Djamil ». Deux candidats restent une ambiguïté rendue à l'humain.
 */
function findMembers(members: Member[], name: string, lastname: string) {
  const exact = members.filter((row) => same(row.name, name) && same(row.lastname, lastname))
  if (exact.length > 0) return exact
  return members.filter((row) => within(row.name, name) && within(row.lastname, lastname))
}

export async function previewEnrollFamily(scope: McpScope, input: Input) {
  const parsed = previewEnrollFamilySchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, paymentsEnabled } = scope
  const data = parsed.data

  // Drapeau actif : le libellé de formule reste obligatoire, comme avant l'introduction
  // du drapeau — seule la coupure le rend facultatif (FR-023).
  if (paymentsEnabled && data.planName === undefined) return 'validationError' as const

  const blockers: McpFinding[] = []
  const warnings: McpFinding[] = []

  // Drapeau coupé : aucun encaissement ne doit être préparé, même déjà rempli sur la fiche.
  if (!paymentsEnabled && data.payment) {
    blockers.push({
      field: 'payment',
      value: String(data.payment.amount),
      reason: 'paymentsDisabled',
    })
  }

  if (data.familyName !== undefined && validateFamilyName(data.familyName) !== 'OK') {
    blockers.push({ field: 'familyName', value: data.familyName, reason: 'invalidFamilyName' })
  }

  // Rattacher à une famille existante réutilise ses élèves : l'enfant déjà saisi sans
  // inscription reçoit la sienne, au lieu d'un second élève homonyme dans la même famille.
  const family = data.familyId
    ? await familyGateway.findMembersForMcp(schoolId, data.familyId)
    : null
  if (data.familyId && !family) {
    blockers.push({ field: 'familyId', value: data.familyId, reason: 'notFound' })
  }

  const members = family?.persons.map((row) => row.person) ?? []
  const studentMembers = data.students.map((student, index) => {
    if (!family) return null

    const found = findMembers(members, student.name, student.lastname)
    if (found.length > 1) {
      blockers.push({
        field: `students.${index}`,
        value: `${student.name} ${student.lastname}`,
        reason: 'ambiguousStudent',
      })
      return null
    }

    const member = found[0] ?? null
    if (member?.student && member.student.enrollments.length > 0) {
      blockers.push({
        field: `students.${index}`,
        value: `${member.name} ${member.lastname}`,
        reason: 'duplicateEnrollment',
      })
    }
    return member
  })

  for (const [index, student] of data.students.entries()) {
    if (student.birthday && validateStudentBirthday(new Date(student.birthday)) !== 'OK') {
      blockers.push({
        field: `students.${index}.birthday`,
        value: student.birthday,
        reason: 'birthdayNotInThePast',
      })
    }
  }

  const classPeriods = await mcpReadGateway.listClassPeriods(schoolId)

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

  // Une formule par élève. Drapeau actif : résolue une fois par libellé, pour que la
  // fratrie qui partage la formule de la famille ne répète pas son blocage, et qu'un
  // libellé porté par un élève nomme l'enfant. Drapeau coupé : tout libellé est ignoré et
  // chaque élève prend la formule réservée « sans tarif » de l'école, créée à la demande,
  // jamais catalogable ni sélectionnable.
  let studentPlans: Array<{ id: string; name: string; amount: number } | null>

  if (paymentsEnabled) {
    const plans = await mcpReadGateway.listPlans(schoolId)
    const planByLabel = new Map<string, { id: string; name: string; amount: number } | null>()

    studentPlans = data.students.map((student, index) => {
      const label = student.planName ?? (data.planName as string)
      const field = student.planName ? `students.${index}.planName` : 'planName'
      const key = `${field}|${label}`

      if (!planByLabel.has(key)) {
        const matches = matchByName(plans, label)
        if (matches.length !== 1) {
          blockers.push({
            field,
            value: label,
            reason: matches.length === 0 ? 'unknownPlan' : 'ambiguousPlan',
          })
        }
        const match = matches.length === 1 ? matches[0] : null
        planByLabel.set(
          key,
          match ? { id: match.id, name: match.name, amount: Number(match.amount) } : null
        )
      }

      return planByLabel.get(key) ?? null
    })
  } else {
    const unpriced = await planGateway.ensureUnpriced(schoolId)
    const reserved = { id: unpriced.id, name: unpriced.name, amount: Number(unpriced.amount) }
    studentPlans = data.students.map(() => reserved)
  }

  const studentTotals = studentPlans.map((plan) =>
    calculateTotalAmount(plan ? Number(plan.amount) : 0, data.discount)
  )

  // La remise vaut pour chaque inscription : elle doit tenir dans la formule la moins chère
  // de la fratrie, et un seul blocage suffit à la corriger.
  if (
    studentPlans.some(
      (plan) => plan && validateDiscount(Number(plan.amount), data.discount) !== 'OK'
    )
  ) {
    blockers.push({
      field: 'discount',
      value: String(data.discount),
      reason: 'discountExceedsPlan',
    })
  }

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
  if (paymentsEnabled && data.payment && studentPlans.every((plan) => plan !== null)) {
    const distribution = distributePayment(
      data.payment.amount,
      studentTotals.map((totalAmount, index) => ({
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

  // La sonde de doublons ne regarde que ce qui sera créé : la famille désignée par son
  // identifiant et ses membres retrouvés sont précisément ceux que l'humain a visés.
  const familyMatches = data.familyName
    ? await familyGateway.searchByName(schoolId, data.familyName)
    : []
  const personMatches = await Promise.all(
    data.students.map((student, index) =>
      studentMembers[index]
        ? []
        : personGateway.searchByName(schoolId, student.name, student.lastname)
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

  if (paymentsEnabled && data.payment?.reference) {
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

  // Chaque élève emporte sa classe et sa formule dans le même élément : un filtre suivi d'un
  // accès par index désalignerait élèves, classes et formules au premier élève non résolu.
  const students = data.students.flatMap<ResolvedStudent>(
    ({ className, planName, ...student }, index) => {
      const classPeriod = studentClasses[index]
      const plan = studentPlans[index]
      if (!classPeriod || !plan) return []

      const enrollment = {
        classPeriod: { id: classPeriod.id, name: classPeriod.name },
        plan: { id: plan.id, name: plan.name, amount: Number(plan.amount) },
        totalAmount: studentTotals[index],
      }

      // Un membre retrouvé n'est pas réécrit : son nom est celui de la base, et le sexe ou la
      // date lus sur la fiche ne remplacent pas en silence ce que le dashboard a saisi.
      const member = studentMembers[index]
      if (member) {
        return [
          {
            name: member.name,
            lastname: member.lastname,
            personId: member.id,
            studentId: member.student?.id,
            ...enrollment,
          },
        ]
      }

      return [
        {
          ...student,
          birthday: student.birthday ? new Date(student.birthday).toISOString() : undefined,
          ...enrollment,
        },
      ]
    }
  )

  if (blockers.length > 0 || students.length !== data.students.length) {
    return { draftId: null, checksum: null, plan: null, matches, warnings, blockers }
  }

  const resolved = {
    tool: ENROLL_FAMILY_TOOL,
    family: family
      ? { id: family.id, name: family.name }
      : {
          name: data.familyName ?? '',
          emergencyContactName: data.emergencyContactName,
          emergencyContactPhone: data.emergencyContactPhone,
          createdById: scope.userId,
        },
    parents: data.parents,
    students,
    discount: data.discount,
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
