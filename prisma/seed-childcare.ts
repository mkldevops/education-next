import { unscopedDbForDataScripts } from '../src/lib/db-unscoped'
import { seedChildcare } from './childcare-fixtures'

/**
 * Garderie de démonstration dans une école existante, sans toucher au reste.
 *
 *   pnpm db:seed:childcare al-nour
 *
 * Réservé à une base locale : le script refuse une base distante.
 */
const prisma = unscopedDbForDataScripts()

async function main() {
  const slug = process.argv[2]
  if (!slug) throw new Error('Usage : pnpm db:seed:childcare <slug-de-l-école>')

  const host = new URL(process.env.DATABASE_URL ?? '').hostname
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    throw new Error(`Base distante (${host}) : ce script ne vise qu'une base locale`)
  }

  const school = await prisma.school.findUnique({ where: { slug }, select: { id: true } })
  if (!school) throw new Error(`École introuvable : ${slug}`)

  const admin = await prisma.schoolMember.findFirst({
    where: { schoolId: school.id, roles: { has: 'ADMIN' } },
    select: { userId: true },
  })
  if (!admin) throw new Error(`Aucun administrateur dans ${slug}`)

  const today = new Date()
  const { subscriptions, receipts } = await seedChildcare(prisma, {
    schoolId: school.id,
    recordedById: admin.userId,
    today,
  })
  console.log(`Garderie de ${slug} : ${subscriptions} enfants, ${receipts} reçus`)
}

main()
  .catch((error) => {
    console.log('Seed garderie échoué :', error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
