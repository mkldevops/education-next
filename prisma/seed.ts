import { PrismaClient } from '@prisma/client'
import { auth } from '../src/lib/auth'

const prisma = new PrismaClient()

async function seed() {
  console.log('Seeding database...')

  await prisma.payment.deleteMany()
  await prisma.classAssignment.deleteMany()
  await prisma.enrollment.deleteMany()
  await prisma.plan.deleteMany()
  await prisma.classPeriod.deleteMany()
  await prisma.level.deleteMany()
  await prisma.period.deleteMany()
  await prisma.phoneNumber.deleteMany()
  await prisma.config.deleteMany()
  await prisma.student.deleteMany()
  await prisma.familyPerson.deleteMany()
  await prisma.person.deleteMany()
  await prisma.userFamily.deleteMany()
  await prisma.family.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.verification.deleteMany()
  await prisma.user.deleteMany()

  console.log('Cleared existing data')

  // --- Users ---
  const adminRes = await auth.api.signUpEmail({
    body: {
      name: 'Admin',
      email: 'admin@school.test',
      password: 'admin123',
    },
  })
  const adminUser = await prisma.user.update({
    where: { id: adminRes.user.id },
    data: { role: 'ADMIN', emailVerified: true },
  })
  console.log(`Created admin: ${adminUser.email}`)

  const parentRes = await auth.api.signUpEmail({
    body: {
      name: 'Marie Dupont',
      email: 'parent@school.test',
      password: 'parent123',
    },
  })
  const parentUser = await prisma.user.update({
    where: { id: parentRes.user.id },
    data: { role: 'PARENT', emailVerified: true },
  })
  console.log(`Created parent: ${parentUser.email}`)

  // --- Families ---
  const familyDupont = await prisma.family.create({
    data: {
      name: 'Dupont',
      emergencyContact: '06 12 34 56 78',
      authorizedPickup: 'Marie Dupont, Pierre Dupont',
      createdById: adminUser.id,
    },
  })

  const familyMartin = await prisma.family.create({
    data: {
      name: 'Martin',
      emergencyContact: '06 98 76 54 32',
      createdById: adminUser.id,
    },
  })
  console.log('Created 2 families')

  // Link parent user to Dupont family
  await prisma.userFamily.create({
    data: { userId: parentUser.id, familyId: familyDupont.id },
  })

  // --- Persons ---
  const mariePerson = await prisma.person.create({
    data: {
      name: 'Marie',
      lastname: 'Dupont',
      sex: 'FEMALE',
      email: 'marie.dupont@email.com',
      address: '12 rue des Lilas',
      postCode: '75001',
      city: 'Paris',
    },
  })

  const pierrePerson = await prisma.person.create({
    data: {
      name: 'Pierre',
      lastname: 'Dupont',
      sex: 'MALE',
      email: 'pierre.dupont@email.com',
    },
  })

  const lucasPerson = await prisma.person.create({
    data: {
      name: 'Lucas',
      lastname: 'Dupont',
      sex: 'MALE',
    },
  })

  const emmaPerson = await prisma.person.create({
    data: {
      name: 'Emma',
      lastname: 'Dupont',
      sex: 'FEMALE',
    },
  })

  const sophieMartin = await prisma.person.create({
    data: {
      name: 'Sophie',
      lastname: 'Martin',
      sex: 'FEMALE',
      email: 'sophie.martin@email.com',
    },
  })

  const leoPerson = await prisma.person.create({
    data: {
      name: 'Leo',
      lastname: 'Martin',
      sex: 'MALE',
    },
  })
  console.log('Created 6 persons')

  // --- FamilyPerson links ---
  await prisma.familyPerson.createMany({
    data: [
      { familyId: familyDupont.id, personId: mariePerson.id, relationType: 'PARENT' },
      { familyId: familyDupont.id, personId: pierrePerson.id, relationType: 'PARENT' },
      { familyId: familyDupont.id, personId: lucasPerson.id, relationType: 'OTHER' },
      { familyId: familyDupont.id, personId: emmaPerson.id, relationType: 'OTHER' },
      { familyId: familyMartin.id, personId: sophieMartin.id, relationType: 'PARENT' },
      { familyId: familyMartin.id, personId: leoPerson.id, relationType: 'OTHER' },
    ],
  })

  // --- Phone numbers ---
  await prisma.phoneNumber.createMany({
    data: [
      {
        personId: mariePerson.id,
        phoneNumber: '06 12 34 56 78',
        channels: JSON.stringify(['sms', 'whatsapp', 'call']),
      },
      {
        personId: pierrePerson.id,
        phoneNumber: '06 11 22 33 44',
        channels: JSON.stringify(['call']),
      },
      {
        personId: sophieMartin.id,
        phoneNumber: '06 98 76 54 32',
        channels: JSON.stringify(['sms', 'call']),
      },
    ],
  })

  // --- Students ---
  const lucasStudent = await prisma.student.create({
    data: {
      personId: lucasPerson.id,
      birthday: new Date('2017-03-15'),
      birthplace: 'Paris',
      languagesAtHome: JSON.stringify(['français', 'anglais']),
      snackAuthorization: true,
    },
  })

  const emmaStudent = await prisma.student.create({
    data: {
      personId: emmaPerson.id,
      birthday: new Date('2019-08-22'),
      birthplace: 'Paris',
      languagesAtHome: JSON.stringify(['français']),
      snackAuthorization: true,
      allergies: 'Arachides',
    },
  })

  const leoStudent = await prisma.student.create({
    data: {
      personId: leoPerson.id,
      birthday: new Date('2018-01-10'),
      birthplace: 'Lyon',
      languagesAtHome: JSON.stringify(['français', 'arabe']),
    },
  })
  console.log('Created 3 students')

  // --- Levels ---
  const cp = await prisma.level.create({ data: { name: 'CP' } })
  const ce1 = await prisma.level.create({ data: { name: 'CE1' } })
  const ce2 = await prisma.level.create({ data: { name: 'CE2' } })
  const cm1 = await prisma.level.create({ data: { name: 'CM1' } })
  const cm2 = await prisma.level.create({ data: { name: 'CM2' } })

  // Set level progression chain
  await prisma.level.update({ where: { id: cp.id }, data: { nextLevelId: ce1.id } })
  await prisma.level.update({ where: { id: ce1.id }, data: { nextLevelId: ce2.id } })
  await prisma.level.update({ where: { id: ce2.id }, data: { nextLevelId: cm1.id } })
  await prisma.level.update({ where: { id: cm1.id }, data: { nextLevelId: cm2.id } })
  console.log('Created 5 levels (CP → CE1 → CE2 → CM1 → CM2)')

  // --- Periods ---
  const period2025 = await prisma.period.create({
    data: {
      name: '2025-2026',
      startAt: new Date('2025-09-01'),
      endAt: new Date('2026-07-04'),
    },
  })

  const _period2026 = await prisma.period.create({
    data: {
      name: '2026-2027',
      startAt: new Date('2026-09-01'),
      endAt: new Date('2027-07-03'),
    },
  })
  console.log('Created 2 periods')

  // --- ClassPeriods ---
  const cpClass = await prisma.classPeriod.create({
    data: { name: 'CP-A', capacity: 25, levelId: cp.id, periodId: period2025.id },
  })

  const ce1Class = await prisma.classPeriod.create({
    data: { name: 'CE1-A', capacity: 25, levelId: ce1.id, periodId: period2025.id },
  })

  const _ce2Class = await prisma.classPeriod.create({
    data: { name: 'CE2-A', capacity: 20, levelId: ce2.id, periodId: period2025.id },
  })
  console.log('Created 3 class-periods')

  // --- Plans ---
  const planFull = await prisma.plan.create({
    data: { name: 'Temps plein', amount: 1200 },
  })

  const planHalf = await prisma.plan.create({
    data: { name: 'Mi-temps', amount: 700 },
  })
  console.log('Created 2 plans')

  // --- Enrollments ---
  const enrollLucas = await prisma.enrollment.create({
    data: {
      studentId: lucasStudent.id,
      planId: planFull.id,
      status: 'ACTIVE',
      totalAmount: 1200,
      discount: 0,
    },
  })

  const enrollEmma = await prisma.enrollment.create({
    data: {
      studentId: emmaStudent.id,
      planId: planFull.id,
      status: 'PENDING',
      totalAmount: 1080,
      discount: 120,
    },
  })

  const enrollLeo = await prisma.enrollment.create({
    data: {
      studentId: leoStudent.id,
      planId: planHalf.id,
      status: 'ACTIVE',
      totalAmount: 700,
      discount: 0,
    },
  })
  console.log('Created 3 enrollments')

  // --- Class Assignments ---
  await prisma.classAssignment.createMany({
    data: [
      { enrollmentId: enrollLucas.id, classPeriodId: ce1Class.id },
      { enrollmentId: enrollEmma.id, classPeriodId: cpClass.id },
      { enrollmentId: enrollLeo.id, classPeriodId: ce1Class.id },
    ],
  })
  console.log('Created 3 class assignments')

  // --- Payments ---
  await prisma.payment.createMany({
    data: [
      {
        familyId: familyDupont.id,
        enrollmentId: enrollLucas.id,
        amount: 400,
        method: 'TRANSFER',
        reference: 'VIR-2025-001',
        paidAt: new Date('2025-09-15'),
        cashedAt: new Date('2025-09-16'),
      },
      {
        familyId: familyDupont.id,
        enrollmentId: enrollLucas.id,
        amount: 400,
        method: 'TRANSFER',
        reference: 'VIR-2025-002',
        paidAt: new Date('2025-12-15'),
        cashedAt: new Date('2025-12-16'),
      },
      {
        familyId: familyMartin.id,
        enrollmentId: enrollLeo.id,
        amount: 350,
        method: 'CHECK',
        reference: 'CHQ-2025-001',
        paidAt: new Date('2025-09-10'),
      },
    ],
  })
  console.log('Created 3 payments')

  // --- Config ---
  await prisma.config.createMany({
    data: [
      { name: 'automatic_promotion', value: 'false', valueType: 'BOOLEAN' },
      { name: 'school_name', value: 'École Al-Nour', valueType: 'TEXT' },
      { name: 'max_students_per_class', value: '25', valueType: 'NUMBER' },
      { name: 'logo_url', value: '', valueType: 'TEXT' },
    ],
  })
  console.log('Created 4 config entries')

  console.log('\n--- Seed complete ---')
  console.log('Admin login:  admin@school.test / admin123')
  console.log('Parent login: parent@school.test / parent123')
}

seed()
  .catch((_e) => {
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
