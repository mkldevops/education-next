import { z } from 'zod'

const phoneNumberFormat = /^\+?[\d\s().-]{6,20}$/

const languagesAtHomeSchema = z.array(z.string().trim().min(1).max(50)).max(20)

export const personInputSchema = z.object({
  name: z.string().min(1).max(250),
  lastname: z.string().min(1).max(250),
  sex: z.enum(['MALE', 'FEMALE']).optional(),
  email: z.email().max(250).optional(),
  address: z.string().max(250).optional(),
  postCode: z.string().max(10).optional(),
  city: z.string().max(250).optional(),
})

const parentInputSchema = personInputSchema
  .omit({ address: true, postCode: true, city: true })
  .extend({
    phoneNumber: z.string().min(1).max(20).regex(phoneNumberFormat).optional(),
  })

export const createFamilySchema = z.object({
  schoolId: z.string().min(1),
  name: z.string().min(1).max(50),
  emergencyContactName: z.string().max(250).optional(),
  emergencyContactPhone: z.string().min(1).max(20).regex(phoneNumberFormat).optional(),
  authorizedPickup: z.string().optional(),
  languagesAtHome: languagesAtHomeSchema.default([]),
  parents: z.array(parentInputSchema),
  address: z.string().max(250).optional(),
  postCode: z.string().max(10).optional(),
  city: z.string().max(250).optional(),
})

// Optional fields are nullish on update: `undefined` leaves the column untouched,
// `null` clears it. Without that distinction an emptied field could never be erased.
export const updateFamilySchema = z.object({
  schoolId: z.string().min(1),
  id: z.string().uuid(),
  name: z.string().min(1).max(50).optional(),
  emergencyContactName: z.string().max(250).nullish(),
  emergencyContactPhone: z.string().min(1).max(20).regex(phoneNumberFormat).nullish(),
  authorizedPickup: z.string().nullish(),
  languagesAtHome: languagesAtHomeSchema.optional(),
})

export const addPersonToFamilySchema = z.object({
  schoolId: z.string().min(1),
  familyId: z.string().uuid(),
  person: personInputSchema,
  relationType: z.enum(['PARENT', 'TUTOR', 'GRANDPARENT', 'SIBLING', 'OTHER']),
  phoneNumber: z.string().min(1).max(20).optional(),
})

export const updateFamilyPersonSchema = z.object({
  schoolId: z.string().min(1),
  familyId: z.string().uuid(),
  personId: z.string().uuid(),
  name: z.string().min(1).max(250).optional(),
  lastname: z.string().min(1).max(250).optional(),
  sex: z.enum(['MALE', 'FEMALE']).nullish(),
  relationType: z.enum(['PARENT', 'TUTOR', 'GRANDPARENT', 'SIBLING', 'OTHER']).optional(),
  email: z.email().max(250).nullish(),
  address: z.string().max(250).nullish(),
  postCode: z.string().max(10).nullish(),
  city: z.string().max(250).nullish(),
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
