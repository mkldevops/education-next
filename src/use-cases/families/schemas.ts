import { z } from 'zod'
import { RelationType, Sex } from '@/generated/prisma/enums'

const sexSchema = z.enum(Sex)
const relationTypeSchema = z.enum(RelationType)

const phoneNumberFormat = /^\+?[\d\s().-]{6,20}$/

const languagesAtHomeSchema = z.array(z.string().trim().min(1).max(50)).max(20)

export const personInputSchema = z.object({
  name: z.string().trim().min(1).max(250),
  lastname: z.string().trim().min(1).max(250),
  sex: sexSchema.optional(),
  email: z.email().max(250).optional(),
  address: z.string().trim().max(250).optional(),
  postCode: z.string().trim().max(10).optional(),
  city: z.string().trim().max(250).optional(),
})

const parentInputSchema = personInputSchema
  .omit({ address: true, postCode: true, city: true })
  .extend({
    phoneNumber: z.string().min(1).max(20).regex(phoneNumberFormat).optional(),
  })

export const createFamilySchema = z.object({
  schoolId: z.string().min(1),
  name: z.string().trim().min(1).max(50),
  emergencyContactName: z.string().trim().max(250).optional(),
  emergencyContactPhone: z.string().min(1).max(20).regex(phoneNumberFormat).optional(),
  authorizedPickup: z.string().trim().optional(),
  languagesAtHome: languagesAtHomeSchema.default([]),
  parents: z.array(parentInputSchema),
  address: z.string().trim().max(250).optional(),
  postCode: z.string().trim().max(10).optional(),
  city: z.string().trim().max(250).optional(),
})

// Optional fields are nullish on update: `undefined` leaves the column untouched,
// `null` clears it. Without that distinction an emptied field could never be erased.
export const updateFamilySchema = z.object({
  schoolId: z.string().min(1),
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(50).optional(),
  emergencyContactName: z.string().trim().max(250).nullish(),
  emergencyContactPhone: z.string().min(1).max(20).regex(phoneNumberFormat).nullish(),
  authorizedPickup: z.string().trim().nullish(),
  languagesAtHome: languagesAtHomeSchema.optional(),
})

export const addPersonToFamilySchema = z.object({
  schoolId: z.string().min(1),
  familyId: z.string().uuid(),
  person: personInputSchema,
  relationType: relationTypeSchema,
  phoneNumber: z.string().min(1).max(20).optional(),
})

export const updateFamilyPersonSchema = z.object({
  schoolId: z.string().min(1),
  familyId: z.string().uuid(),
  personId: z.string().uuid(),
  name: z.string().trim().min(1).max(250).optional(),
  lastname: z.string().trim().min(1).max(250).optional(),
  sex: sexSchema.nullish(),
  relationType: relationTypeSchema.optional(),
  email: z.email().max(250).nullish(),
  address: z.string().trim().max(250).nullish(),
  postCode: z.string().trim().max(10).nullish(),
  city: z.string().trim().max(250).nullish(),
  phoneNumber: z.string().min(1).max(20).regex(phoneNumberFormat).nullish(),
})

export const phoneNumberSchema = z.object({
  phoneNumber: z.string().min(1).max(20).regex(phoneNumberFormat),
  channels: z.array(z.enum(['sms', 'whatsapp', 'call'])).default([]),
})

export const linkUserToFamilySchema = z.object({
  schoolId: z.string().min(1),
  userId: z.string(),
  familyId: z.string().uuid(),
})

export const attachStudentToFamilySchema = z.object({
  schoolId: z.string().min(1),
  studentId: z.uuid(),
  familyId: z.uuid(),
})

export const createFamilyForStudentSchema = z.object({
  schoolId: z.string().min(1),
  studentId: z.uuid(),
  createdById: z.string().min(1),
  name: z.string().trim().min(1).max(50),
  emergencyContactName: z.string().trim().max(250).optional(),
  emergencyContactPhone: z.string().trim().max(20).regex(phoneNumberFormat).optional(),
})
