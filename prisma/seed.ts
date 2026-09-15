import { auth } from '../src/lib/auth'
import { unscopedDbForDataScripts } from '../src/lib/db-unscoped'

/**
 * Seed à DEUX écoles.
 *
 * Deux, pas une : c'est la seule façon de rendre une fuite cross-école observable.
 * Un seed mono-école ferait passer les tests d'isolation par accident.
 *
 * Passe par `unscopedDbForDataScripts` — le seed crée les écoles elles-mêmes et purge
 * des tables entières, deux opérations qu'aucun scope ne peut décrire.
 */
const prisma = unscopedDbForDataScripts()

/**
 * Ordre imposé par les clés étrangères. `PaymentProviderEvent`, `PaymentTransaction`
 * et `Invitation` étaient absents de l'ancienne purge : ils retiennent des références
 * vers `Family` et `User`, et bloquaient donc la suppression des écoles.
 */
async function purge() {
  await prisma.paymentProviderEvent.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.paymentTransaction.deleteMany()
  await prisma.invitation.deleteMany()
  await prisma.teacherExpense.deleteMany()
  await prisma.classPeriodTeacher.deleteMany()
  await prisma.classAssignment.deleteMany()
  await prisma.enrollment.deleteMany()
  await prisma.plan.deleteMany()
  await prisma.classPeriod.deleteMany()
  await prisma.teacher.deleteMany()
  await prisma.level.deleteMany()
  await prisma.period.deleteMany()
  await prisma.phoneNumber.deleteMany()
  await prisma.config.deleteMany()
  await prisma.student.deleteMany()
  await prisma.familyPerson.deleteMany()
  await prisma.person.deleteMany()
  await prisma.userFamily.deleteMany()
  await prisma.family.deleteMany()
  await prisma.mcpApiKey.deleteMany()
  await prisma.schoolMember.deleteMany()
  await prisma.passkey.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.verification.deleteMany()
  await prisma.user.deleteMany()
  await prisma.school.deleteMany()
}

async function createUser(name: string, email: string, password: string) {
  const created = await auth.api.signUpEmail({ body: { name, email, password } })
  await prisma.user.update({
    where: { id: created.user.id },
    data: { emailVerified: true },
  })
  return created.user.id
}

type SchoolFixture = {
  schoolId: string
  familyName: string
  parentFirstName: string
  parentLastName: string
  childFirstName: string
  createdById: string
  fullTimeAmount: number
  /**
   * Thème et capacité **distincts** d'une école à l'autre : sans valeurs
   * différentes, l'isolation du branding et du thème serait invérifiable — deux
   * écoles identiques rendent le même écran, qu'elles soient scopées ou non.
   */
  themePrimary: string
  maxStudentsPerClass: number
}

/** Référentiel et dossiers d'une école. Chaque écriture porte son `schoolId`. */
async function seedSchoolContent(fixture: SchoolFixture) {
  const { schoolId, createdById } = fixture

  const levelNames = ['CP', 'CE1', 'CE2', 'CM1', 'CM2']
  const levels = []
  for (const name of levelNames) {
    levels.push(await prisma.level.create({ data: { schoolId, name } }))
  }
  // Chaîne de progression, intra-école : la FK composite l'impose désormais.
  for (let index = 0; index < levels.length - 1; index += 1) {
    await prisma.level.update({
      where: { id_schoolId: { id: levels[index].id, schoolId } },
      data: { nextLevelId: levels[index + 1].id },
    })
  }

  const currentPeriod = await prisma.period.create({
    data: {
      schoolId,
      name: '2025-2026',
      startAt: new Date('2025-09-01'),
      endAt: new Date('2026-07-04'),
    },
  })
  const nextPeriod = await prisma.period.create({
    data: {
      schoolId,
      name: '2026-2027',
      startAt: new Date('2026-09-01'),
      endAt: new Date('2027-07-03'),
    },
  })

  const classCp = await prisma.classPeriod.create({
    data: {
      schoolId,
      name: 'CP-A',
      capacity: 25,
      levelId: levels[0].id,
      periodId: currentPeriod.id,
    },
  })
  const teachers = await prisma.teacher.createManyAndReturn({
    data: [
      {
        schoolId,
        firstName: 'Amina',
        lastName: 'Benali',
        email: `amina.${fixture.familyName.toLowerCase()}@school.test`,
      },
      {
        schoolId,
        firstName: 'Karim',
        lastName: 'Foudil',
        email: `karim.${fixture.familyName.toLowerCase()}@school.test`,
      },
    ],
  })
  await prisma.classPeriodTeacher.createMany({
    data: teachers.map((teacher) => ({
      schoolId,
      classPeriodId: classCp.id,
      teacherId: teacher.id,
    })),
  })

  await prisma.classPeriod.create({
    data: {
      schoolId,
      name: 'CE1-A',
      capacity: 25,
      levelId: levels[1].id,
      periodId: currentPeriod.id,
    },
  })
  await prisma.classPeriod.create({
    data: { schoolId, name: 'CP-A', capacity: 25, levelId: levels[0].id, periodId: nextPeriod.id },
  })

  const fullTime = await prisma.plan.create({
    data: { schoolId, name: 'Temps plein', amount: fixture.fullTimeAmount },
  })
  await prisma.plan.create({
    data: { schoolId, name: 'Mi-temps', amount: fixture.fullTimeAmount / 2 },
  })

  const family = await prisma.family.create({
    data: {
      schoolId,
      name: fixture.familyName,
      emergencyContactName: `${fixture.parentFirstName} ${fixture.parentLastName}`,
      emergencyContactPhone: '06 12 34 56 78',
      languagesAtHome: ['Français'],
      createdById,
    },
  })

  const parentPerson = await prisma.person.create({
    data: {
      schoolId,
      name: fixture.parentFirstName,
      lastname: fixture.parentLastName,
      sex: 'FEMALE',
      email: `${fixture.parentFirstName.toLowerCase()}@${fixture.familyName.toLowerCase()}.test`,
      // Pas de `schoolId` ici : il appartient à la FK composite vers `Person`, donc
      // Prisma le dérive du parent et refuse qu'on le fournisse.
      families: { create: { familyId: family.id, relationType: 'PARENT' } },
      phoneNumbers: { create: { phoneNumber: '06 12 34 56 78', channels: [] } },
    },
  })

  const childPerson = await prisma.person.create({
    data: {
      schoolId,
      name: fixture.childFirstName,
      lastname: fixture.parentLastName,
      sex: 'MALE',
      families: { create: { familyId: family.id, relationType: 'OTHER' } },
    },
  })

  const student = await prisma.student.create({
    data: {
      schoolId,
      personId: childPerson.id,
      birthday: new Date('2018-04-12'),
      birthplace: 'Paris',
      snackAuthorization: true,
    },
  })

  const enrollment = await prisma.enrollment.create({
    data: {
      schoolId,
      studentId: student.id,
      planId: fullTime.id,
      status: 'ACTIVE',
      totalAmount: fixture.fullTimeAmount,
      discount: 0,
    },
  })

  await prisma.classAssignment.create({
    data: { schoolId, enrollmentId: enrollment.id, classPeriodId: classCp.id },
  })

  await prisma.payment.create({
    data: {
      schoolId,
      familyId: family.id,
      enrollmentId: enrollment.id,
      amount: fixture.fullTimeAmount / 4,
      method: 'TRANSFER',
      reference: 'Acompte',
      paidAt: new Date(),
      cashedAt: new Date(),
    },
  })

  // `school_name` a disparu : le nom de l'école vit sur `School.name`.
  // Le thème et la capacité diffèrent d'une école à l'autre, sinon les deux
  // rendraient le même écran et l'isolation ne serait pas observable.
  await prisma.config.createMany({
    data: [
      { schoolId, name: 'automatic_promotion', value: 'false', valueType: 'BOOLEAN' },
      {
        schoolId,
        name: 'max_students_per_class',
        value: String(fixture.maxStudentsPerClass),
        valueType: 'NUMBER',
      },
      { schoolId, name: 'theme_primary', value: fixture.themePrimary, valueType: 'COLOR' },
      { schoolId, name: 'logo_url', value: '', valueType: 'TEXT' },
      { schoolId, name: 'favicon_url', value: '', valueType: 'TEXT' },
      {
        schoolId,
        name: 'teacher_expenses_enabled',
        value: 'false',
        valueType: 'BOOLEAN',
      },
    ],
  })

  return { familyId: family.id, parentPersonId: parentPerson.id }
}

async function seed() {
  console.log('Seeding database...')
  await purge()
  console.log('Cleared existing data')

  const alNour = await prisma.school.create({
    data: { name: 'École Al-Nour', slug: 'al-nour', city: 'Paris' },
  })
  const horizon = await prisma.school.create({
    data: { name: 'École Horizon', slug: 'horizon', city: 'Paris' },
  })
  console.log(`Created 2 schools: ${alNour.name}, ${horizon.name}`)

  // Aucune appartenance : ce compte exerce la branche super-admin du contexte d'école.
  const superAdminId = await createUser('Super Admin', 'superadmin@school.test', 'superadmin123')
  await prisma.user.update({ where: { id: superAdminId }, data: { isSuperAdmin: true } })

  // Membre des DEUX écoles : c'est ce compte qui permet de tester la bascule.
  const adminId = await createUser('Admin Réseau', 'admin@school.test', 'admin123')
  await prisma.schoolMember.createMany({
    data: [
      { userId: adminId, schoolId: alNour.id, role: 'ADMIN' },
      { userId: adminId, schoolId: horizon.id, role: 'ADMIN' },
    ],
  })

  const alNourContent = await seedSchoolContent({
    schoolId: alNour.id,
    familyName: 'Dupont',
    parentFirstName: 'Marie',
    parentLastName: 'Dupont',
    childFirstName: 'Lucas',
    createdById: adminId,
    fullTimeAmount: 1200,
    themePrimary: '#3c6e71',
    maxStudentsPerClass: 25,
  })

  const horizonContent = await seedSchoolContent({
    schoolId: horizon.id,
    familyName: 'Martin',
    parentFirstName: 'Sophie',
    parentLastName: 'Martin',
    childFirstName: 'Léo',
    createdById: adminId,
    fullTimeAmount: 980,
    themePrimary: '#8c3b6e',
    maxStudentsPerClass: 18,
  })

  // Parent d'une seule école : ne doit jamais voir l'autre.
  const parentAlNourId = await createUser('Marie Dupont', 'parent@school.test', 'parent123')
  await prisma.schoolMember.create({
    data: { userId: parentAlNourId, schoolId: alNour.id, role: 'PARENT' },
  })
  await prisma.userFamily.create({
    data: { userId: parentAlNourId, schoolId: alNour.id, familyId: alNourContent.familyId },
  })

  const parentHorizonId = await createUser(
    'Sophie Martin',
    'parent.horizon@school.test',
    'parent123'
  )
  await prisma.schoolMember.create({
    data: { userId: parentHorizonId, schoolId: horizon.id, role: 'PARENT' },
  })
  await prisma.userFamily.create({
    data: { userId: parentHorizonId, schoolId: horizon.id, familyId: horizonContent.familyId },
  })

  // Cas d'usage central de la feature : un compte unique, deux écoles, deux dossiers
  // familiaux distincts qui ne se voient pas.
  const parentBothId = await createUser('Karim Benali', 'parent.both@school.test', 'parent123')
  for (const [schoolId, familyLabel, childName] of [
    [alNour.id, 'Benali', 'Adam'],
    [horizon.id, 'Benali', 'Yasmine'],
  ] as const) {
    await prisma.schoolMember.create({
      data: { userId: parentBothId, schoolId, role: 'PARENT' },
    })

    const family = await prisma.family.create({
      data: {
        schoolId,
        name: familyLabel,
        emergencyContactName: 'Karim Benali',
        emergencyContactPhone: '06 55 44 33 22',
        languagesAtHome: ['Français', 'Arabe'],
        createdById: adminId,
      },
    })
    await prisma.userFamily.create({
      data: { userId: parentBothId, schoolId, familyId: family.id },
    })

    const child = await prisma.person.create({
      data: {
        schoolId,
        name: childName,
        lastname: familyLabel,
        sex: 'MALE',
        families: { create: { familyId: family.id, relationType: 'OTHER' } },
      },
    })
    await prisma.student.create({
      data: {
        schoolId,
        personId: child.id,
        birthday: new Date('2019-09-20'),
      },
    })
  }

  console.log('Seed complete')
  console.log('  superadmin@school.test / superadmin123  (plateforme, aucune école)')
  console.log('  admin@school.test / admin123            (ADMIN des deux écoles)')
  console.log('  parent@school.test / parent123          (Al-Nour)')
  console.log('  parent.horizon@school.test / parent123  (Horizon)')
  console.log('  parent.both@school.test / parent123     (les deux, deux dossiers)')
}

seed()
  .catch((error) => {
    console.log('Seed failed:', error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
