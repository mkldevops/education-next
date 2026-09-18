/**
 * La famille redevable d'un élève.
 *
 * Un élève peut être rattaché à plusieurs familles (garde partagée). La dette de ses
 * inscriptions n'est portée que par une seule d'entre elles, jamais par toutes : sinon le
 * même montant serait réclamé en double. La famille retenue est celle dont `relationType`
 * a la priorité la plus haute, dans l'ordre où `RelationType` est déclaré
 * (`prisma/schema.prisma`) — un parent avant un tuteur, un tuteur avant un grand-parent, etc.
 * Un rattachement à égalité de priorité (deux `OTHER`, par exemple) se départage par
 * `familyId` pour rester déterministe.
 *
 * `familiesOutstanding` (`src/domain/payment-stats.ts`), `findPayableByFamily`
 * (`src/gateways/enrollment-gateway.ts`) et la page `/dashboard/families` partagent cette
 * même résolution : un élève sans famille redevable désignée ailleurs ne peut pas apparaître
 * facturé sur une fiche famille où il n'est que secondaire.
 */

type RelationType = 'PARENT' | 'TUTOR' | 'GRANDPARENT' | 'SIBLING' | 'OTHER'

const RELATION_PRIORITY: Record<RelationType, number> = {
  PARENT: 0,
  TUTOR: 1,
  GRANDPARENT: 2,
  SIBLING: 3,
  OTHER: 4,
}

export type FamilyLink = {
  familyId: string
  relationType: RelationType
}

/** La famille redevable parmi les rattachements d'un même élève, ou `null` si aucun. */
export function resolveDebtorFamily<T extends FamilyLink>(families: T[]): T | null {
  if (families.length === 0) return null

  return families.reduce((best, candidate) => {
    const rank = RELATION_PRIORITY[candidate.relationType]
    const bestRank = RELATION_PRIORITY[best.relationType]
    if (rank < bestRank) return candidate
    if (rank === bestRank && candidate.familyId < best.familyId) return candidate
    return best
  })
}
