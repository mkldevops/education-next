// @vitest-environment node

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FAMILY_DELETION_CLEARED_RELATIONS } from '@/gateways/family-gateway'

/**
 * Garde-fou structurel de `familyGateway.deleteWithRelated`.
 *
 * La suppression d'une famille efface explicitement chaque table qui pointe vers son
 * graphe sans cascade. Une table ajoutée plus tard — comme `AttendanceEntry`, oubliée
 * à son arrivée — ferait échouer la suppression en P2003 dès sa première ligne. Ce test
 * relit `schema.prisma` et exige que toute relation de ce genre soit déclarée dans
 * `FAMILY_DELETION_CLEARED_RELATIONS`, donc traitée par la transaction.
 *
 * Le client Prisma généré n'embarque pas les actions référentielles : le schéma source
 * est la seule description complète, d'où cette lecture textuelle plutôt que le DMMF.
 */

/** Tables que `deleteWithRelated` vide elle-même, de la feuille vers la famille. */
const EXPLICITLY_DELETED = [
  'Family',
  'Person',
  'Student',
  'Enrollment',
  'ClassAssignment',
  'AttendanceEntry',
  'Payment',
  'PaymentTransaction',
  'Invitation',
  'Receipt',
]

type Relation = {
  model: string
  field: string
  target: string
  onDelete: string
}

function parseRelations(schema: string): Relation[] {
  const relations: Relation[] = []
  let model: string | null = null
  for (const line of schema.split('\n')) {
    const header = line.match(/^model (\w+) \{/)
    if (header) {
      model = header[1]
      continue
    }
    if (line.startsWith('}')) {
      model = null
      continue
    }
    if (!model || !line.includes('@relation(') || !line.includes('fields:')) continue
    const field = line.trim().match(/^(\w+)\s+(\w+)(\?)?/)
    if (!field) continue
    const [, name, target, optional] = field
    // Prisma : sans `onDelete`, une relation requise vaut `Restrict`, une optionnelle `SetNull`.
    const explicit = line.match(/onDelete:\s*(\w+)/)?.[1]
    relations.push({
      model,
      field: name,
      target,
      onDelete: explicit ?? (optional ? 'SetNull' : 'Restrict'),
    })
  }
  return relations
}

const relations = parseRelations(
  readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8')
)

/** Le graphe effacé : les tables vidées explicitement, plus ce que la base cascade depuis elles. */
function removedModels() {
  const removed = new Set(EXPLICITLY_DELETED)
  let grew = true
  while (grew) {
    grew = false
    for (const relation of relations) {
      if (
        relation.onDelete === 'Cascade' &&
        removed.has(relation.target) &&
        !removed.has(relation.model)
      ) {
        removed.add(relation.model)
        grew = true
      }
    }
  }
  return removed
}

describe('suppression définitive de famille — relations bloquantes', () => {
  it('lit effectivement les relations du schéma', () => {
    expect(relations.length).toBeGreaterThan(20)
    expect(relations).toContainEqual({
      model: 'AttendanceEntry',
      field: 'student',
      target: 'Student',
      onDelete: 'Restrict',
    })
  })

  it('traite chaque relation non cascadée vers une ligne effacée', () => {
    const removed = removedModels()
    const blocking = relations
      .filter(
        (relation) =>
          removed.has(relation.target) && !['Cascade', 'SetNull'].includes(relation.onDelete)
      )
      .map((relation) => `${relation.model}.${relation.field}`)
      .sort()

    // Une relation manquante ici : l'effacer dans `deleteWithRelated` avant sa cible,
    // l'ajouter à `FAMILY_DELETION_CLEARED_RELATIONS`, et documenter le choix dans
    // `docs/business-rules.md` (« Deleting a family for good »).
    expect(blocking).toEqual([...FAMILY_DELETION_CLEARED_RELATIONS].sort())
  })

  it("n'étend le graphe par cascade qu'aux tables attendues", () => {
    const removed = removedModels()
    const cascaded = [...removed].filter((model) => !EXPLICITLY_DELETED.includes(model)).sort()
    // Tables emportées par la base : un ajout ici mérite une relecture de la règle métier.
    expect(cascaded).toEqual([
      'ChildcareCharge',
      'ChildcarePayment',
      'ChildcareSubscription',
      'FamilyPerson',
      'MealAbsence',
      'MealAccount',
      'MealAdjustment',
      'MealPayment',
      'MealSchedule',
      'PhoneNumber',
      'UserFamily',
    ])
  })
})
