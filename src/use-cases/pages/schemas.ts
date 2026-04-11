import { z } from 'zod'

const safeHref = (v: string) => /^(https?:\/\/|\/)/.test(v)

const heroBlockSchema = z.object({
  type: z.literal('hero'),
  title: z.string().min(1).max(250),
  subtitle: z.string().max(500).optional(),
  ctaLabel: z.string().max(100).optional(),
  ctaHref: z
    .string()
    .max(250)
    .refine(
      (v) => !v || safeHref(v),
      'Button link must be a relative path or start with http(s)://'
    )
    .optional(),
  backgroundImage: z.string().url().max(500).optional(),
})

const textBlockSchema = z.object({
  type: z.literal('text'),
  title: z.string().max(250).optional(),
  content: z.string().min(1).max(50000),
})

const featureItemSchema = z.object({
  title: z.string().min(1).max(150),
  description: z.string().max(500),
  icon: z.string().max(50).optional(),
})

const featuresBlockSchema = z.object({
  type: z.literal('features'),
  title: z.string().max(250).optional(),
  items: z.array(featureItemSchema).min(1).max(12),
})

const ctaBlockSchema = z.object({
  type: z.literal('cta'),
  title: z.string().min(1).max(250),
  subtitle: z.string().max(500).optional(),
  ctaLabel: z.string().max(100),
  ctaHref: z
    .string()
    .max(250)
    .refine(safeHref, 'Button link must be a relative path or start with http(s)://'),
})

const statItemSchema = z.object({
  label: z.string().min(1).max(100),
  value: z.string().min(1).max(50),
})

const statsBlockSchema = z.object({
  type: z.literal('stats'),
  title: z.string().max(250).optional(),
  items: z.array(statItemSchema).min(1).max(8),
})

const contactBlockSchema = z.object({
  type: z.literal('contact'),
  title: z.string().max(250).optional(),
  showEmail: z.boolean().default(true),
  showPhone: z.boolean().default(true),
  showAddress: z.boolean().default(true),
})

export const blockSchema = z.discriminatedUnion('type', [
  heroBlockSchema,
  textBlockSchema,
  featuresBlockSchema,
  ctaBlockSchema,
  statsBlockSchema,
  contactBlockSchema,
])

export type Block = z.infer<typeof blockSchema>
export type BlockType = Block['type']

const RESERVED_SLUGS = ['a-propos', 'contact', 'legal-notices', 'privacy-policy']

const pageInputSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
    .refine((s) => !RESERVED_SLUGS.includes(s), 'This slug is reserved for existing pages'),
  title: z.string().min(1).max(250),
  isHome: z.boolean().default(false),
  published: z.boolean().default(true),
  blocks: z.array(blockSchema).default([]),
  sortOrder: z.number().int().default(0),
})

export const createPageSchema = pageInputSchema

export const updatePageSchema = pageInputSchema.extend({
  id: z.string().uuid(),
})

export const deletePageSchema = z.object({
  id: z.string().uuid(),
})

export type PageInput = z.infer<typeof pageInputSchema>
export type CreatePageInput = z.infer<typeof createPageSchema>
export type UpdatePageInput = z.infer<typeof updatePageSchema>
