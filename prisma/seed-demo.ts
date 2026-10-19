import { credentialUserGateway } from '../src/gateways/credential-user-gateway'
import { unscopedDbForDataScripts } from '../src/lib/db-unscoped'

/**
 * École de démonstration, à côté des écoles réelles d'une instance.
 *
 *   pnpm db:seed:demo            recrée l'école de démo
 *   pnpm db:seed:demo --remove   la supprime, comptes de démo compris
 *
 * Contrairement à `seed.ts`, rien n'est purgé hors de l'école `DEMO_SLUG` et des
 * comptes `DEMO_ACCOUNTS` : le script peut donc viser une base de production. Les
 * dates sont relatives au jour d'exécution, pour que la démo paraisse vivante quel
 * que soit le jour où elle est rejouée.
 */
const prisma = unscopedDbForDataScripts()

const DEMO_SLUG = 'ecole-demo'
const DEMO_DOMAIN = 'ecole-demo.test'

const DEMO_ACCOUNTS = {
  admin: { name: 'Direction Démo', email: `admin@${DEMO_DOMAIN}`, password: 'DemoAdmin2026!' },
  teacher: {
    name: 'Ahmed Madi',
    email: `enseignant@${DEMO_DOMAIN}`,
    password: 'DemoProf2026!',
  },
  parent: { name: 'Anrifa Abdallah', email: `parent@${DEMO_DOMAIN}`, password: 'DemoParent2026!' },
} as const

const DAY_MS = 24 * 60 * 60 * 1000

/** Générateur déterministe : deux exécutions produisent la même démo. */
function seededRandom(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

const random = seededRandom(2026)
const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)]
const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1))

const utcDay = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
const today = utcDay(new Date())
const daysFromToday = (offset: number) => new Date(today.getTime() + offset * DAY_MS)
const isoWeekday = (date: Date) => date.getUTCDay() || 7
const atTime = (day: Date, time: string) => {
  const [hours, minutes] = time.split(':').map(Number)
  return new Date(day.getTime() + (hours * 60 + minutes) * 60 * 1000)
}

const LEVELS = ['Niveau Maternelle', 'Niveau 1', 'Niveau 2', 'Niveau 3', 'Niveau 4', 'Niveau 5']

const CLASSES = [
  { name: 'Maternelle', levelIndex: 0 },
  { name: 'Niveau 1 — Groupe A', levelIndex: 1 },
  { name: 'Niveau 1 — Groupe B', levelIndex: 1 },
  { name: 'Niveau 2', levelIndex: 2 },
  { name: 'Niveau 3', levelIndex: 3 },
  { name: 'Niveau 4', levelIndex: 4 },
  { name: 'Niveau 5', levelIndex: 5 },
] as const

const TEACHERS = [
  { firstName: 'Ahmed', lastName: 'Madi' },
  { firstName: 'Fatima', lastName: 'Houmadi' },
  { firstName: 'Saïd', lastName: 'Abdallah' },
  { firstName: 'Zaharia', lastName: 'Attoumani' },
  { firstName: 'Ibrahim', lastName: 'Combo' },
  { firstName: 'Mariama', lastName: 'Soilihi' },
  { firstName: 'Ali', lastName: 'Youssouf' },
  { firstName: 'Hadidja', lastName: 'Ousseni' },
] as const

const EVENING_CLASS = {
  startTime: '16:30',
  endTime: '18:00',
  description: 'Coran : lecture, mémorisation et récitation.',
}

/** Cours du soir chaque jour de semaine : un appel reste démontrable quel que soit le jour. */
const SCHEDULE = [
  ...[1, 2, 4, 5].map((weekday) => ({ weekday, ...EVENING_CLASS })),
  {
    weekday: 3,
    startTime: '14:00',
    endTime: '16:00',
    description: 'Langue arabe : alphabet, lecture, écriture.',
  },
  {
    weekday: 6,
    startTime: '08:00',
    endTime: '10:00',
    description: 'Éducation islamique : ablutions, prière, sira.',
  },
]

const FAMILY_NAMES = [
  'Abdallah',
  'Ahamada',
  'Ali',
  'Anli',
  'Assani',
  'Attoumani',
  'Boinali',
  'Bacar',
  'Chanfi',
  'Combo',
  'Daoud',
  'Djoumoi',
  'Halidi',
  'Hamada',
  'Houmadi',
  'Ibrahima',
  'Kassim',
  'Madi',
  'Mohamed',
  'Mouhoutar',
  'Moussa',
  'Nassor',
  'Ousseni',
  'Rachidi',
  'Said',
  'Saindou',
  'Soilihi',
  'Toiouil',
  'Youssouf',
  'Zoubert',
  'Mlanao',
  'Ridjali',
] as const

const MALE_NAMES = [
  'Nassim',
  'Ibrahim',
  'Kamal',
  'Anzize',
  'Ismaël',
  'Rayan',
  'Idriss',
  'Soufiane',
  'Yanis',
  'Ilyas',
  'Moustoifa',
  'Djamal',
  'Fahad',
  'Nourdine',
  'Amir',
  'Bilal',
  'Hakim',
  'Zakaria',
] as const

const FEMALE_NAMES = [
  'Anrifa',
  'Zaïna',
  'Faïza',
  'Riziki',
  'Mariama',
  'Hadidja',
  'Echati',
  'Nasra',
  'Soifia',
  'Amina',
  'Inaya',
  'Kaoutar',
  'Laïla',
  'Sitti',
  'Naïma',
  'Raïssa',
  'Yasmina',
  'Fatouma',
] as const

const VILLAGES = [
  "M'tsangadoua",
  "M'tsangadoua",
  "M'tsangadoua",
  'Acoua',
  'Mtsamboro',
  'Bandraboua',
]

const CHILD_COUNTS = [
  2, 1, 3, 2, 1, 2, 2, 1, 3, 2, 1, 2, 2, 1, 2, 3, 1, 2, 2, 1, 2, 2, 1, 3, 2, 1, 2, 1, 2, 2, 1, 2,
]

const ABSENCE_MESSAGES = [
  'Malade, certificat apporté par la maman.',
  'Rendez-vous médical au dispensaire.',
  'Voyage familial à Anjouan.',
  null,
  null,
] as const

type DemoEvent = {
  title: string
  slug: string
  summary?: string
  category: 'MEETING' | 'TERM_START' | 'OUTING' | 'HOLIDAY' | 'CLOSURE' | 'CELEBRATION'
  visibility: 'PUBLIC' | 'MEMBERS' | 'STAFF'
  status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED'
  startOffsetDays: number
  endOffsetDays?: number
  startHour?: number
  endHour?: number
  location?: string
  announceDaysBefore?: number
}

const EVENTS: DemoEvent[] = [
  {
    title: 'Rentrée de la madrassah',
    slug: 'rentree-de-la-madrassah',
    summary: 'Accueil des élèves et des familles, remise des cahiers.',
    category: 'TERM_START',
    visibility: 'PUBLIC',
    status: 'PUBLISHED',
    startOffsetDays: -32,
    location: 'Salle principale',
    announceDaysBefore: 14,
  },
  {
    title: 'Réunion parents-enseignants',
    slug: 'reunion-parents-enseignants',
    summary: 'Bilan du premier mois et présentation du programme de récitation.',
    category: 'MEETING',
    visibility: 'MEMBERS',
    status: 'PUBLISHED',
    startOffsetDays: 4,
    startHour: 17,
    endHour: 19,
    location: 'Salle principale',
    announceDaysBefore: 10,
  },
  {
    title: 'Conseil des enseignants',
    slug: 'conseil-des-enseignants',
    category: 'MEETING',
    visibility: 'STAFF',
    status: 'DRAFT',
    startOffsetDays: 8,
    startHour: 16,
    endHour: 18,
    location: 'Bureau de la direction',
  },
  {
    title: 'Vacances scolaires',
    slug: 'vacances-scolaires',
    category: 'HOLIDAY',
    visibility: 'PUBLIC',
    status: 'PUBLISHED',
    startOffsetDays: 15,
    endOffsetDays: 30,
    announceDaysBefore: 14,
  },
  {
    title: 'Concours de récitation du Coran',
    slug: 'concours-de-recitation',
    summary: 'Les élèves de chaque niveau récitent devant un jury. Familles bienvenues.',
    category: 'CELEBRATION',
    visibility: 'PUBLIC',
    status: 'PUBLISHED',
    startOffsetDays: 38,
    startHour: 8,
    endHour: 12,
    location: 'Place du village',
    announceDaysBefore: 21,
  },
  {
    title: 'Sortie pédagogique à la plage',
    slug: 'sortie-pedagogique-plage',
    summary: 'Reportée en raison de la météo, une nouvelle date sera communiquée.',
    category: 'OUTING',
    visibility: 'MEMBERS',
    status: 'CANCELLED',
    startOffsetDays: 45,
    startHour: 8,
    endHour: 13,
    location: 'Plage de Mtsanga Mtiti',
    announceDaysBefore: 7,
  },
  {
    title: 'Journée de nettoyage des locaux',
    slug: 'journee-nettoyage',
    summary: 'Pas de cours ce jour-là, les parents volontaires sont attendus à 7 h.',
    category: 'CLOSURE',
    visibility: 'PUBLIC',
    status: 'PUBLISHED',
    startOffsetDays: 52,
    announceDaysBefore: 7,
  },
  {
    title: 'Remise des prix du trimestre',
    slug: 'remise-des-prix',
    summary: 'Récompenses pour l’assiduité et la mémorisation.',
    category: 'CELEBRATION',
    visibility: 'PUBLIC',
    status: 'PUBLISHED',
    startOffsetDays: 70,
    startHour: 15,
    endHour: 17,
    location: 'Salle principale',
    announceDaysBefore: 14,
  },
]

const emailPart = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toLowerCase()

/** Tout ce que l'école de démo possède, dans l'ordre imposé par les clés étrangères. */
async function removeDemo() {
  const school = await prisma.school.findUnique({ where: { slug: DEMO_SLUG } })
  const emails = Object.values(DEMO_ACCOUNTS).map((account) => account.email)

  if (school) {
    const where = { schoolId: school.id }
    await prisma.aiConversation.deleteMany({ where })
    await prisma.mcpDraft.deleteMany({ where })
    await prisma.mcpOAuthGrant.deleteMany({ where })
    await prisma.mcpApiKey.deleteMany({ where })
    await prisma.eventImage.deleteMany({ where })
    await prisma.event.deleteMany({ where })
    await prisma.payment.deleteMany({ where })
    await prisma.paymentTransaction.deleteMany({ where })
    await prisma.invitation.deleteMany({ where })
    await prisma.teacherExpense.deleteMany({ where })
    await prisma.attendanceEntry.deleteMany({ where })
    await prisma.attendanceSession.deleteMany({ where })
    await prisma.classScheduleSlotTeacher.deleteMany({ where })
    await prisma.classScheduleSlot.deleteMany({ where })
    await prisma.classPeriodTeacher.deleteMany({ where })
    await prisma.classAssignment.deleteMany({ where })
    await prisma.enrollment.deleteMany({ where })
    await prisma.plan.deleteMany({ where })
    await prisma.classPeriod.deleteMany({ where })
    await prisma.teacher.deleteMany({ where })
    await prisma.levelProgression.deleteMany({ where })
    await prisma.level.deleteMany({ where })
    await prisma.period.deleteMany({ where })
    await prisma.phoneNumber.deleteMany({ where })
    await prisma.config.deleteMany({ where })
    await prisma.student.deleteMany({ where })
    await prisma.familyPerson.deleteMany({ where })
    await prisma.userFamily.deleteMany({ where })
    await prisma.person.deleteMany({ where })
    await prisma.family.deleteMany({ where })
    await prisma.schoolMember.deleteMany({ where })
    await prisma.school.delete({ where: { id: school.id } })
  }

  const { count } = await prisma.user.deleteMany({ where: { email: { in: emails } } })
  console.log(school ? `École de démo supprimée (${count} comptes)` : 'Aucune école de démo')
}

async function createDemo() {
  const school = await prisma.school.create({
    data: {
      name: 'École Démo',
      slug: DEMO_SLUG,
      address: '12 rue de la Mosquée',
      postCode: '97630',
      city: "M'tsangadoua",
    },
  })
  const schoolId = school.id

  const adminId = (await credentialUserGateway.create(DEMO_ACCOUNTS.admin)).id
  const teacherUserId = (await credentialUserGateway.create(DEMO_ACCOUNTS.teacher)).id
  const parentUserId = (await credentialUserGateway.create(DEMO_ACCOUNTS.parent)).id
  // La proposition de clé d'accès interromprait chaque connexion pendant la présentation.
  await prisma.user.updateMany({
    where: { id: { in: [adminId, teacherUserId, parentUserId] } },
    data: { signInUpgradeDismissedAt: new Date() },
  })
  await prisma.schoolMember.createMany({
    data: [
      { userId: adminId, schoolId, role: 'ADMIN' },
      { userId: teacherUserId, schoolId, role: 'TEACHER' },
      { userId: parentUserId, schoolId, role: 'PARENT' },
    ],
  })

  await prisma.config.createMany({
    data: [
      { schoolId, name: 'theme_primary', value: '#264653', valueType: 'COLOR' },
      { schoolId, name: 'theme_primary_hover', value: '#1b323c', valueType: 'COLOR' },
      { schoolId, name: 'theme_primary_light', value: '#e9c46a', valueType: 'COLOR' },
      { schoolId, name: 'theme_background', value: '#fdf8ef', valueType: 'COLOR' },
      { schoolId, name: 'logo_url', value: '', valueType: 'TEXT' },
      { schoolId, name: 'max_students_per_class', value: '15', valueType: 'NUMBER' },
      { schoolId, name: 'automatic_promotion', value: 'false', valueType: 'BOOLEAN' },
      { schoolId, name: 'payments_enabled', value: 'true', valueType: 'BOOLEAN' },
      { schoolId, name: 'stripe_enabled', value: 'false', valueType: 'BOOLEAN' },
      { schoolId, name: 'teacher_expenses_enabled', value: 'true', valueType: 'BOOLEAN' },
      { schoolId, name: 'events_enabled', value: 'true', valueType: 'BOOLEAN' },
      { schoolId, name: 'attendance_enabled', value: 'true', valueType: 'BOOLEAN' },
      { schoolId, name: 'class_schedule_enabled', value: 'true', valueType: 'BOOLEAN' },
      { schoolId, name: 'class_schedule_visibility', value: 'PUBLIC', valueType: 'TEXT' },
      {
        schoolId,
        name: 'class_schedule_teacher_overlap_allowed',
        value: 'false',
        valueType: 'BOOLEAN',
      },
    ],
  })

  const levels = []
  for (const name of LEVELS) {
    levels.push(await prisma.level.create({ data: { schoolId, name } }))
  }
  for (let index = 0; index < levels.length - 1; index += 1) {
    await prisma.levelProgression.create({
      data: { schoolId, levelId: levels[index].id, nextLevelId: levels[index + 1].id },
    })
  }

  const schoolYear = today.getUTCMonth() >= 7 ? today.getUTCFullYear() : today.getUTCFullYear() - 1
  const period = await prisma.period.create({
    data: {
      schoolId,
      name: `${schoolYear}-${schoolYear + 1}`,
      startAt: daysFromToday(-35),
      endAt: new Date(Date.UTC(schoolYear + 1, 6, 3)),
    },
  })

  const teachers: { id: string }[] = []
  for (const [index, teacher] of TEACHERS.entries()) {
    teachers.push(
      await prisma.teacher.create({
        data: {
          schoolId,
          ...teacher,
          userId: index === 0 ? teacherUserId : undefined,
          email:
            index === 0
              ? DEMO_ACCOUNTS.teacher.email
              : `${emailPart(teacher.firstName)}.${emailPart(teacher.lastName)}@${DEMO_DOMAIN}`,
          phone: `06 39 10 20 ${String(30 + index).padStart(2, '0')}`,
        },
      })
    )
  }

  const classes = []
  for (const [index, classFixture] of CLASSES.entries()) {
    const classPeriod = await prisma.classPeriod.create({
      data: {
        schoolId,
        name: classFixture.name,
        capacity: 15,
        levelId: levels[classFixture.levelIndex].id,
        periodId: period.id,
      },
    })
    await prisma.classPeriodTeacher.create({
      data: { schoolId, classPeriodId: classPeriod.id, teacherId: teachers[index].id },
    })
    const slots = []
    for (const slot of SCHEDULE) {
      slots.push(
        await prisma.classScheduleSlot.create({
          data: {
            schoolId,
            classPeriodId: classPeriod.id,
            ...slot,
            teachers: { create: { teacherId: teachers[index].id } },
          },
        })
      )
    }
    classes.push({ ...classFixture, classPeriod, slots, teacherId: teachers[index].id })
  }

  const annual = await prisma.plan.create({
    data: { schoolId, name: 'Cotisation annuelle', amount: 150 },
  })
  const kindergarten = await prisma.plan.create({
    data: { schoolId, name: 'Cotisation Maternelle', amount: 100 },
  })
  await prisma.plan.create({ data: { schoolId, name: 'Cotisation trimestrielle', amount: 55 } })

  const rosters = new Map<string, { studentId: string; studentName: string }[]>()
  const usedFirstNames = new Set<string>()
  const uniqueFirstName = (sex: 'MALE' | 'FEMALE', lastName: string) => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const name = pick(sex === 'MALE' ? MALE_NAMES : FEMALE_NAMES)
      if (!usedFirstNames.has(`${name} ${lastName}`)) {
        usedFirstNames.add(`${name} ${lastName}`)
        return name
      }
    }
    return pick(sex === 'MALE' ? MALE_NAMES : FEMALE_NAMES)
  }

  let receipt = 1
  let pendingLeft = 3
  let studentCount = 0
  const paymentMethods = ['CASH', 'CASH', 'CASH', 'TRANSFER', 'TRANSFER', 'CHECK', 'CARD'] as const

  for (const [familyIndex, familyName] of FAMILY_NAMES.entries()) {
    const isParentDemo = familyIndex === 0
    const village = pick(VILLAGES)
    const motherName = isParentDemo ? 'Anrifa' : pick(FEMALE_NAMES)
    const fatherName = pick(MALE_NAMES)
    const phone = `06 39 ${between(10, 99)} ${between(10, 99)} ${between(10, 99)}`

    const family = await prisma.family.create({
      data: {
        schoolId,
        name: familyName,
        emergencyContactName: `${motherName} ${familyName}`,
        emergencyContactPhone: phone,
        authorizedPickup:
          random() < 0.5 ? `Les parents, la grand-mère et l’oncle ${fatherName}.` : undefined,
        languagesAtHome: random() < 0.7 ? ['Shimaoré', 'Français'] : ['Shimaoré', 'Kibushi'],
        createdById: adminId,
        createdAt: daysFromToday(-between(36, 60)),
      },
    })

    await prisma.person.create({
      data: {
        schoolId,
        name: motherName,
        lastname: familyName,
        sex: 'FEMALE',
        email: `${emailPart(motherName)}.${emailPart(familyName)}@${DEMO_DOMAIN}`,
        city: village,
        postCode: '97630',
        families: { create: { familyId: family.id, relationType: 'PARENT' } },
        phoneNumbers: { create: { phoneNumber: phone, channels: ['SMS', 'WHATSAPP'] } },
      },
    })
    if (random() < 0.6) {
      await prisma.person.create({
        data: {
          schoolId,
          name: fatherName,
          lastname: familyName,
          sex: 'MALE',
          city: village,
          postCode: '97630',
          families: { create: { familyId: family.id, relationType: 'PARENT' } },
          phoneNumbers: {
            create: {
              phoneNumber: `06 39 ${between(10, 99)} ${between(10, 99)} ${between(10, 99)}`,
              channels: ['WHATSAPP'],
            },
          },
        },
      })
    }

    if (isParentDemo) {
      await prisma.userFamily.create({
        data: { userId: parentUserId, schoolId, familyId: family.id },
      })
    }

    const familyEnrollments = []
    for (let childIndex = 0; childIndex < CHILD_COUNTS[familyIndex]; childIndex += 1) {
      const sex = random() < 0.5 ? 'MALE' : 'FEMALE'
      const firstName = uniqueFirstName(sex, familyName)
      const classIndex = isParentDemo ? [0, 3][childIndex] : between(0, CLASSES.length - 1)
      const classFixture = classes[classIndex]
      const age = 5 + classFixture.levelIndex
      const birthday = new Date(
        Date.UTC(
          today.getUTCFullYear() - age - (random() < 0.4 ? 1 : 0),
          between(0, 11),
          between(1, 28)
        )
      )

      const child = await prisma.person.create({
        data: {
          schoolId,
          name: firstName,
          lastname: familyName,
          sex,
          city: village,
          postCode: '97630',
          families: { create: { familyId: family.id, relationType: 'OTHER' } },
        },
      })
      const student = await prisma.student.create({
        data: {
          schoolId,
          personId: child.id,
          birthday,
          birthplace: random() < 0.85 ? 'Mamoudzou' : 'Moroni',
          previousSchool: random() < 0.2 ? 'Madrassah de Mtsamboro' : undefined,
          snackAuthorization: random() < 0.7,
          allergies: random() < 0.08 ? pick(['Arachides', 'Lactose', 'Fruits de mer']) : undefined,
          healthNotes: random() < 0.05 ? 'Asthme léger, ventoline dans le cartable.' : undefined,
        },
      })

      const plan = classFixture.levelIndex === 0 ? kindergarten : annual
      const discount = childIndex > 0 ? 20 : 0
      const status =
        !isParentDemo && pendingLeft > 0 && random() < 0.12
          ? 'PENDING'
          : !isParentDemo && familyIndex === 7 && childIndex === 0
            ? 'CANCELLED'
            : 'ACTIVE'
      if (status === 'PENDING') pendingLeft -= 1

      const enrollment = await prisma.enrollment.create({
        data: {
          schoolId,
          studentId: student.id,
          planId: plan.id,
          status,
          totalAmount: Number(plan.amount) - discount,
          discount,
          registeredAt: status === 'PENDING' ? daysFromToday(-between(1, 6)) : family.createdAt,
          canLeaveAlone: age >= 9 && random() < 0.5,
        },
      })
      studentCount += 1

      if (status !== 'ACTIVE') continue

      await prisma.classAssignment.create({
        data: {
          schoolId,
          enrollmentId: enrollment.id,
          classPeriodId: classFixture.classPeriod.id,
          startAt: period.startAt,
        },
      })
      const roster = rosters.get(classFixture.classPeriod.id) ?? []
      roster.push({ studentId: student.id, studentName: `${familyName} ${firstName}` })
      rosters.set(classFixture.classPeriod.id, roster)
      familyEnrollments.push({
        id: enrollment.id,
        due: Number(plan.amount) - discount,
      })
    }

    const profile = isParentDemo
      ? 'partial'
      : random() < 0.45
        ? 'paid'
        : random() < 0.65
          ? 'partial'
          : 'none'
    for (const [enrollmentIndex, enrollment] of familyEnrollments.entries()) {
      const installments =
        profile === 'paid'
          ? random() < 0.5
            ? [enrollment.due]
            : [enrollment.due / 2, enrollment.due / 2]
          : profile === 'partial' && enrollmentIndex === 0
            ? [Math.round((enrollment.due * between(3, 7)) / 100) * 10]
            : []
      for (const amount of installments) {
        const method = pick(paymentMethods)
        const paidAt = daysFromToday(-between(2, 30))
        const uncashed = method === 'CHECK' && random() < 0.5
        await prisma.payment.create({
          data: {
            schoolId,
            familyId: family.id,
            enrollmentId: enrollment.id,
            amount,
            method,
            reference: `Reçu n° ${String(receipt).padStart(4, '0')}`,
            paidAt: atTime(paidAt, `${between(9, 17)}:00`),
            cashedAt: uncashed ? undefined : new Date(paidAt.getTime() + 2 * DAY_MS),
          },
        })
        receipt += 1
      }
    }
  }

  const attendanceStart = utcDay(period.startAt)
  let sessionCount = 0
  for (const classFixture of classes) {
    const roster = rosters.get(classFixture.classPeriod.id) ?? []
    if (roster.length === 0) continue
    const recorderId = classFixture.teacherId === teachers[0].id ? teacherUserId : adminId

    for (let day = attendanceStart; day < today; day = new Date(day.getTime() + DAY_MS)) {
      for (const slot of classFixture.slots.filter((item) => item.weekday === isoWeekday(day))) {
        const validatedAt = atTime(day, slot.endTime)
        const session = await prisma.attendanceSession.create({
          data: {
            schoolId,
            classPeriodId: classFixture.classPeriod.id,
            classScheduleSlotId: slot.id,
            occurrenceKey: slot.id,
            occurredOn: day,
            status: 'VALIDATED',
            createdById: recorderId,
            updatedById: recorderId,
            validatedAt,
            createdAt: atTime(day, slot.startTime),
          },
        })
        await prisma.attendanceEntry.createMany({
          data: roster.map(({ studentId, studentName }) => {
            const roll = random()
            const status = roll < 0.86 ? 'PRESENT' : roll < 0.93 ? 'LATE' : 'ABSENT'
            return {
              schoolId,
              attendanceSessionId: session.id,
              studentId,
              studentName,
              status,
              lateMinutes: status === 'LATE' ? pick([5, 10, 15, 20]) : undefined,
              message: status === 'ABSENT' ? pick(ABSENCE_MESSAGES) : undefined,
              updatedById: recorderId,
            }
          }),
        })
        sessionCount += 1
      }
    }
  }

  await prisma.teacherExpense.createMany({
    data: [
      {
        teacherId: 0,
        amount: 42.5,
        category: 'Fournitures',
        description: 'Cahiers et crayons pour la Maternelle',
        offset: -28,
        paid: true,
      },
      {
        teacherId: 2,
        amount: 18,
        category: 'Photocopies',
        description: 'Fiches d’alphabet arabe',
        offset: -21,
        paid: true,
      },
      {
        teacherId: 4,
        amount: 35,
        category: 'Goûter',
        description: 'Goûter de la rentrée',
        offset: -30,
        paid: true,
      },
      {
        teacherId: 1,
        amount: 60,
        category: 'Transport',
        description: 'Taxi-brousse pour la formation à Mamoudzou',
        offset: -9,
        paid: false,
      },
      {
        teacherId: 5,
        amount: 24.9,
        category: 'Fournitures',
        description: 'Supports de lecture (juz Amma)',
        offset: -5,
        paid: false,
      },
      {
        teacherId: 0,
        amount: 15,
        category: 'Photocopies',
        description: 'Feuilles de suivi de mémorisation',
        offset: -2,
        paid: false,
      },
    ].map(({ teacherId, offset, paid, ...expense }) => ({
      schoolId,
      teacherId: teachers[teacherId].id,
      ...expense,
      requestedAt: daysFromToday(offset),
      paidAt: paid ? daysFromToday(offset + 4) : undefined,
    })),
  })

  await prisma.event.createMany({
    data: EVENTS.map(({ startOffsetDays, endOffsetDays, startHour, endHour, ...event }) => {
      const startDay = daysFromToday(startOffsetDays)
      return {
        ...event,
        schoolId,
        allDay: startHour === undefined,
        startAt: startHour === undefined ? startDay : atTime(startDay, `${startHour}:00`),
        endAt:
          endOffsetDays !== undefined
            ? daysFromToday(endOffsetDays)
            : endHour !== undefined
              ? atTime(startDay, `${endHour}:00`)
              : undefined,
      }
    }),
  })

  console.log(`École de démo créée : ${FAMILY_NAMES.length} familles, ${studentCount} élèves,`)
  console.log(`  ${classes.length} classes, ${teachers.length} enseignants, ${sessionCount} appels`)
  for (const account of Object.values(DEMO_ACCOUNTS)) {
    console.log(`  ${account.email} / ${account.password}`)
  }
}

async function main() {
  await removeDemo()
  if (process.argv.includes('--remove')) return
  await createDemo()
}

main()
  .catch((error) => {
    console.log('Seed démo échoué :', error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
