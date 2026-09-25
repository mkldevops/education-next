import type { EnrollmentProposal } from '@/use-cases/ai-assistant/schemas'

export type SexValue = '' | 'MALE' | 'FEMALE'
export type MethodValue = 'CASH' | 'CARD' | 'TRANSFER' | 'CHECK'

export type ParentForm = {
  name: string
  lastname: string
  sex: SexValue
  email: string
  phoneNumber: string
}

export type StudentForm = {
  name: string
  lastname: string
  sex: SexValue
  birthday: string
  birthplace: string
  className: string
  planName: string
}

export type PaymentForm = {
  amount: string
  method: MethodValue
  reference: string
  paidAt: string
  cashedAt: string
}

export type MissingField = NonNullable<EnrollmentProposal['missing']>[number]

/**
 * L'état du formulaire est un jeu de chaînes, une par champ : ce qu'un humain tape, pas ce
 * que l'aperçu attend. La conversion vers l'entrée métier se fait au moment de l'aperçu,
 * et l'école existante n'est jamais choisie par le modèle — `family.id` ne se remplit
 * que par le bouton « Rattacher » d'une correspondance.
 */
export type ProposalForm = {
  family: { id: string | null; name: string }
  parents: ParentForm[]
  students: StudentForm[]
  emergencyContactName: string
  emergencyContactPhone: string
  planName: string
  discount: string
  payment: PaymentForm | null
  missing: MissingField[]
  notes: string
}

export const EMPTY_PARENT: ParentForm = {
  name: '',
  lastname: '',
  sex: '',
  email: '',
  phoneNumber: '',
}

export const EMPTY_STUDENT: StudentForm = {
  name: '',
  lastname: '',
  sex: '',
  birthday: '',
  birthplace: '',
  className: '',
  planName: '',
}

export const EMPTY_PAYMENT: PaymentForm = {
  amount: '',
  method: 'CASH',
  reference: '',
  paidAt: '',
  cashedAt: '',
}

export function emptyProposalForm(): ProposalForm {
  return {
    family: { id: null, name: '' },
    parents: [],
    students: [{ ...EMPTY_STUDENT }],
    emergencyContactName: '',
    emergencyContactPhone: '',
    planName: '',
    discount: '',
    payment: null,
    missing: [],
    notes: '',
  }
}

const text = (value: string | undefined) => value ?? ''
const sex = (value: 'MALE' | 'FEMALE' | undefined): SexValue => value ?? ''

/**
 * Une proposition du modèle remplit un formulaire neuf ; elle ne fusionne jamais avec les
 * corrections en cours, sinon une seconde lecture de la fiche écraserait en silence ce
 * que l'humain vient de corriger. L'appelant décide quand l'appliquer.
 */
export function proposalToForm(proposal: EnrollmentProposal): ProposalForm {
  const students = (proposal.students ?? []).map((student) => ({
    name: text(student.name),
    lastname: text(student.lastname),
    sex: sex(student.sex),
    birthday: text(student.birthday),
    birthplace: text(student.birthplace),
    className: text(student.className),
    planName: text(student.planName),
  }))

  return {
    family: { id: null, name: text(proposal.familyName) },
    parents: (proposal.parents ?? []).map((parent) => ({
      name: text(parent.name),
      lastname: text(parent.lastname),
      sex: sex(parent.sex),
      email: text(parent.email),
      phoneNumber: text(parent.phoneNumber),
    })),
    students: students.length > 0 ? students : [{ ...EMPTY_STUDENT }],
    emergencyContactName: text(proposal.emergencyContactName),
    emergencyContactPhone: text(proposal.emergencyContactPhone),
    planName: text(proposal.planName),
    discount: proposal.discount === undefined ? '' : String(proposal.discount),
    payment: proposal.payment
      ? {
          amount: proposal.payment.amount === undefined ? '' : String(proposal.payment.amount),
          method: proposal.payment.method ?? 'CASH',
          reference: text(proposal.payment.reference),
          paidAt: text(proposal.payment.paidAt),
          cashedAt: '',
        }
      : null,
    missing: proposal.missing ?? [],
    notes: text(proposal.notes),
  }
}

const optional = (value: string) => {
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

const optionalNumber = (value: string) => {
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  const parsed = Number(trimmed.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

/**
 * Projette le formulaire vers l'entrée de `previewEnrollFamilySchema`, sans la valider :
 * le schéma reste le seul juge, côté serveur. Une famille rattachée n'emporte ni parents
 * ni contact d'urgence, règle du schéma que l'écran rend visible plutôt que contournée.
 */
export function formToPreviewInput(form: ProposalForm, paymentsEnabled: boolean): unknown {
  const students = form.students.map((student) => ({
    name: student.name.trim(),
    lastname: student.lastname.trim(),
    sex: student.sex === '' ? undefined : student.sex,
    birthday: optional(student.birthday),
    birthplace: optional(student.birthplace),
    className: student.className.trim(),
    planName: paymentsEnabled ? optional(student.planName) : undefined,
  }))

  const family = form.family.id
    ? { familyId: form.family.id }
    : {
        familyName: form.family.name.trim(),
        parents: form.parents.map((parent) => ({
          name: parent.name.trim(),
          lastname: parent.lastname.trim(),
          sex: parent.sex === '' ? undefined : parent.sex,
          email: optional(parent.email),
          phoneNumber: optional(parent.phoneNumber),
        })),
        emergencyContactName: optional(form.emergencyContactName),
        emergencyContactPhone: optional(form.emergencyContactPhone),
      }

  const pricing = paymentsEnabled
    ? {
        planName: optional(form.planName),
        discount: optionalNumber(form.discount),
        payment: form.payment
          ? {
              amount: optionalNumber(form.payment.amount),
              method: form.payment.method,
              reference: optional(form.payment.reference),
              paidAt: optional(form.payment.paidAt),
              cashedAt:
                form.payment.method === 'CHECK' ? optional(form.payment.cashedAt) : undefined,
            }
          : undefined,
      }
    : {}

  return { ...family, students, ...pricing }
}

/** Empreinte stable du formulaire : deux aperçus du même contenu partagent la même clé. */
export function formFingerprint(form: ProposalForm, paymentsEnabled: boolean): string {
  return JSON.stringify(formToPreviewInput(form, paymentsEnabled))
}
