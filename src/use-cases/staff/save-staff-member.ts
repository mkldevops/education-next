import type { z } from 'zod'
import { staffMemberGateway } from '@/gateways/staff-member-gateway'
import { createStaffMemberSchema, updateStaffMemberSchema } from './schemas'

/** Ajoute un membre du personnel à la liste de l'école. */
export async function createStaffMember(
  input: z.input<typeof createStaffMemberSchema>,
  gateway = staffMemberGateway
) {
  const parsed = createStaffMemberSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, note, ...data } = parsed.data
  return gateway.create(schoolId, { ...data, note: note || null })
}

/**
 * Renomme, exempte ou retire un membre du personnel. Le retirer garde ses comptes et ses
 * reçus ; il ne peut plus être inscrit ni encaissé.
 */
export async function updateStaffMember(
  input: z.input<typeof updateStaffMemberSchema>,
  gateway = staffMemberGateway
) {
  const parsed = updateStaffMemberSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, id, note, ...data } = parsed.data
  return (await gateway.update(schoolId, id, { ...data, note: note || null }))
    ? ('OK' as const)
    : ('notFound' as const)
}
