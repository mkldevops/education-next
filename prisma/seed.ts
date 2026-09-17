import { auth } from '../src/lib/auth'
import { unscopedDbForDataScripts } from '../src/lib/db-unscoped'
import {
  DEMO_CLASSES,
  DEMO_EVENTS,
  DEMO_FAMILIES,
  DEMO_SCHEDULE_SLOTS,
  DEMO_TEACHERS,
  EXPECTED_SEED_COUNTS,
  HORIZON_DEMO_CLASSES,
  HORIZON_DEMO_FAMILIES,
  HORIZON_DEMO_TEACHERS,
} from './seed-fixtures'

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
  await prisma.eventImage.deleteMany()
  await prisma.event.deleteMany()
  await prisma.paymentProviderEvent.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.paymentTransaction.deleteMany()
  await prisma.invitation.deleteMany()
  await prisma.teacherExpense.deleteMany()
  await prisma.classScheduleSlotTeacher.deleteMany()
  await prisma.classScheduleSlot.deleteMany()
  await prisma.attendanceEntry.deleteMany()
  await prisma.attendanceSession.deleteMany()
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

const emailPart = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

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
  scheduleVisibility: 'INTERNAL' | 'PUBLIC'
  classes: readonly { name: string; levelIndex: number }[]
  teachers: readonly { firstName: string; lastName: string }[]
  families: typeof HORIZON_DEMO_FAMILIES
}

/** Référentiel et dossiers d'une école. Chaque écriture porte son `schoolId`. */
async function seedSchoolContent(fixture: SchoolFixture) {
  const { schoolId, createdById, classes, teachers: teacherFixtures, families } = fixture

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

  const previousPeriod = await prisma.period.create({
    data: {
      schoolId,
      name: '2025-2026',
      startAt: new Date('2025-09-01'),
      endAt: new Date('2026-07-04'),
    },
  })
  const currentPeriod = await prisma.period.create({
    data: {
      schoolId,
      name: '2026-2027',
      startAt: new Date('2026-09-01'),
      endAt: new Date('2027-07-03'),
    },
  })

  await prisma.classPeriod.createMany({
    data: [
      {
        schoolId,
        name: 'CP-A',
        capacity: fixture.maxStudentsPerClass,
        levelId: levels[0].id,
        periodId: previousPeriod.id,
      },
      {
        schoolId,
        name: 'CE1-A',
        capacity: fixture.maxStudentsPerClass,
        levelId: levels[1].id,
        periodId: previousPeriod.id,
      },
    ],
  })

  const teachers = await prisma.teacher.createManyAndReturn({
    data: teacherFixtures.map((teacher, index) => ({
      schoolId,
      ...teacher,
      email: `${emailPart(teacher.firstName)}.${emailPart(teacher.lastName)}.${emailPart(fixture.familyName)}@school.test`,
      phone: `06 70 80 90 ${10 + index}`,
    })),
  })

  const currentClasses = []
  for (const classFixture of classes) {
    currentClasses.push(
      await prisma.classPeriod.create({
        data: {
          schoolId,
          name: classFixture.name,
          capacity: fixture.maxStudentsPerClass,
          levelId: levels[classFixture.levelIndex].id,
          periodId: currentPeriod.id,
        },
      })
    )
  }

  await prisma.classPeriodTeacher.createMany({
    data: currentClasses.map((classPeriod, index) => ({
      schoolId,
      classPeriodId: classPeriod.id,
      teacherId: teachers[index].id,
    })),
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
    data: {
      schoolId,
      enrollmentId: enrollment.id,
      classPeriodId: currentClasses[2].id,
      startAt: currentPeriod.startAt,
    },
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

  // Des fratries et des niveaux variés donnent du volume aux listes tout en gardant
  // des dossiers réalistes : chaque élève est inscrit et affecté à la période active.
  for (const familyFixture of families) {
    const seededFamily = await prisma.family.create({
      data: {
        schoolId,
        name: familyFixture.name,
        emergencyContactName: `${familyFixture.parentFirstName} ${familyFixture.name}`,
        emergencyContactPhone: familyFixture.phone,
        authorizedPickup: `Les parents et grands-parents de la famille ${familyFixture.name}.`,
        languagesAtHome: familyFixture.languagesAtHome,
        createdById,
      },
    })

    await prisma.person.create({
      data: {
        schoolId,
        name: familyFixture.parentFirstName,
        lastname: familyFixture.name,
        sex: familyFixture.parentSex,
        email: `${emailPart(familyFixture.parentFirstName)}@${emailPart(familyFixture.name)}.test`,
        city: 'Paris',
        families: { create: { familyId: seededFamily.id, relationType: 'PARENT' } },
        phoneNumbers: {
          create: { phoneNumber: familyFixture.phone, channels: ['SMS', 'WHATSAPP'] },
        },
      },
    })

    for (const childFixture of familyFixture.children) {
      const child = await prisma.person.create({
        data: {
          schoolId,
          name: childFixture.firstName,
          lastname: familyFixture.name,
          sex: childFixture.sex,
          city: 'Paris',
          families: { create: { familyId: seededFamily.id, relationType: 'OTHER' } },
        },
      })
      const seededStudent = await prisma.student.create({
        data: {
          schoolId,
          personId: child.id,
          birthday: new Date(childFixture.birthday),
          birthplace: 'Paris',
          snackAuthorization: childFixture.snackAuthorization ?? false,
          allergies: childFixture.allergies,
        },
      })
      const seededEnrollment = await prisma.enrollment.create({
        data: {
          schoolId,
          studentId: seededStudent.id,
          planId: fullTime.id,
          status: 'ACTIVE',
          totalAmount: fixture.fullTimeAmount,
          discount: 0,
        },
      })
      await prisma.classAssignment.create({
        data: {
          schoolId,
          enrollmentId: seededEnrollment.id,
          classPeriodId: currentClasses[childFixture.classIndex].id,
          startAt: currentPeriod.startAt,
        },
      })
    }
  }

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
      {
        schoolId,
        name: 'teacher_expenses_enabled',
        value: 'false',
        valueType: 'BOOLEAN',
      },
      { schoolId, name: 'events_enabled', value: 'true', valueType: 'BOOLEAN' },
      { schoolId, name: 'attendance_enabled', value: 'true', valueType: 'BOOLEAN' },
      { schoolId, name: 'class_schedule_enabled', value: 'true', valueType: 'BOOLEAN' },
      {
        schoolId,
        name: 'class_schedule_teacher_overlap_allowed',
        value: 'true',
        valueType: 'BOOLEAN',
      },
      {
        schoolId,
        name: 'class_schedule_visibility',
        value: fixture.scheduleVisibility,
        valueType: 'TEXT',
      },
    ],
  })

  // Vingt créneaux par école : chaque classe possède quatre rendez-vous hebdomadaires
  // et son enseignant attitré, sans chevauchement d'enseignant entre deux classes.
  await Promise.all(
    currentClasses.flatMap((classPeriod, classIndex) =>
      DEMO_SCHEDULE_SLOTS.map((slot) =>
        prisma.classScheduleSlot.create({
          data: {
            schoolId,
            classPeriodId: classPeriod.id,
            ...slot,
            teachers: { create: { teacherId: teachers[classIndex].id } },
          },
        })
      )
    )
  )

  // Le calendrier couvre catégories, audiences et états de cycle de vie afin que les
  // filtres, les annonces et les variantes visuelles soient observables dès le seed.
  const day = 24 * 60 * 60 * 1000
  const atUtcMidnight = (offsetDays: number) => {
    const date = new Date(Date.now() + offsetDays * day)
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  }

  await prisma.event.createMany({
    data: DEMO_EVENTS.map((event) => {
      const startAt = atUtcMidnight(event.startOffsetDays)
      const timedStartAt =
        event.startHour === undefined
          ? startAt
          : new Date(startAt.getTime() + event.startHour * 60 * 60 * 1000)
      const endAt =
        event.endOffsetDays !== undefined
          ? atUtcMidnight(event.endOffsetDays)
          : event.endHour !== undefined
            ? new Date(startAt.getTime() + event.endHour * 60 * 60 * 1000)
            : undefined

      return {
        schoolId,
        title: event.title,
        slug: event.slug,
        summary: event.summary,
        category: event.category,
        visibility: event.visibility,
        status: event.status,
        allDay: event.startHour === undefined,
        startAt: timedStartAt,
        endAt,
        location: event.location,
        announceDaysBefore: event.announceDaysBefore,
      }
    }),
  })

  return {
    familyId: family.id,
    parentPersonId: parentPerson.id,
    fullTimePlanId: fullTime.id,
    fullTimeAmount: fixture.fullTimeAmount,
    defaultClassId: currentClasses[0].id,
    currentPeriodStartAt: currentPeriod.startAt,
  }
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
    scheduleVisibility: 'PUBLIC',
    classes: DEMO_CLASSES,
    teachers: DEMO_TEACHERS,
    families: DEMO_FAMILIES,
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
    scheduleVisibility: 'INTERNAL',
    classes: HORIZON_DEMO_CLASSES,
    teachers: HORIZON_DEMO_TEACHERS,
    families: HORIZON_DEMO_FAMILIES,
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
  for (const [schoolId, familyLabel, childName, childSex, schoolContent] of [
    [alNour.id, 'Benali', 'Adam', 'MALE', alNourContent],
    [horizon.id, 'Benali', 'Yasmine', 'FEMALE', horizonContent],
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
        sex: childSex,
        families: { create: { familyId: family.id, relationType: 'OTHER' } },
      },
    })
    const student = await prisma.student.create({
      data: {
        schoolId,
        personId: child.id,
        birthday: new Date('2019-09-20'),
        birthplace: 'Paris',
        snackAuthorization: true,
      },
    })
    const enrollment = await prisma.enrollment.create({
      data: {
        schoolId,
        studentId: student.id,
        planId: schoolContent.fullTimePlanId,
        status: 'ACTIVE',
        totalAmount: schoolContent.fullTimeAmount,
        discount: 0,
      },
    })
    await prisma.classAssignment.create({
      data: {
        schoolId,
        enrollmentId: enrollment.id,
        classPeriodId: schoolContent.defaultClassId,
        startAt: schoolContent.currentPeriodStartAt,
      },
    })
  }

  console.log('Seed complete')
  console.log(
    `  Al-Nour: ${EXPECTED_SEED_COUNTS.alNour.classes} classes, ${EXPECTED_SEED_COUNTS.alNour.families} familles, ${EXPECTED_SEED_COUNTS.alNour.students} élèves, ${EXPECTED_SEED_COUNTS.alNour.scheduleSlots} créneaux`
  )
  console.log(
    `  Horizon: ${EXPECTED_SEED_COUNTS.horizon.classes} classes, ${EXPECTED_SEED_COUNTS.horizon.families} familles, ${EXPECTED_SEED_COUNTS.horizon.students} élèves, ${EXPECTED_SEED_COUNTS.horizon.scheduleSlots} créneaux`
  )
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
