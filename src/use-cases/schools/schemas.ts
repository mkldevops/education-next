import { z } from 'zod'

/**
 * Le slug est la clé stable d'une école : minuscules, chiffres et tirets simples.
 * Il n'est pas dérivé du nom, qui reste librement modifiable.
 */
const slugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)

const identitySchema = {
  name: z.string().min(1).max(250),
  slug: slugSchema,
  address: z.string().max(250).optional(),
  postCode: z.string().max(10).optional(),
  city: z.string().max(250).optional(),
}

export const createSchoolSchema = z.object(identitySchema)

export const updateSchoolSchema = z.object({ id: z.uuid(), ...identitySchema })

export const schoolIdSchema = z.object({ id: z.uuid() })
