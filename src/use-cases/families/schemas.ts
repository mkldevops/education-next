import { z } from 'zod'

export const personInputSchema = z.object({
  name: z.string().min(1).max(250),
  lastname: z.string().min(1).max(250),
  sex: z.enum(['MALE', 'FEMALE']),
  email: z.email().max(250).optional(),
  address: z.string().max(250).optional(),
  postCode: z.string().max(10).optional(),
  city: z.string().max(250).optional(),
})

export const createFamilySchema = z.object({
  name: z.string().min(1).max(50),
  emergencyContact: z.string().max(250).optional(),
  authorizedPickup: z.string().optional(),
})

export const updateFamilySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50).optional(),
  emergencyContact: z.string().max(250).optional(),
  authorizedPickup: z.string().optional(),
})

export const addPersonToFamilySchema = z.object({
  familyId: z.string().uuid(),
  person: personInputSchema,
  relationType: z.enum(['PARENT', 'TUTOR', 'GRANDPARENT', 'SIBLING', 'OTHER']),
})

export const phoneNumberSchema = z.object({
  phoneNumber: z.string().min(1).max(20),
  channels: z.array(z.enum(['sms', 'whatsapp', 'call'])).default([]),
})

export const linkUserToFamilySchema = z.object({
  userId: z.string(),
  familyId: z.string().uuid(),
})
