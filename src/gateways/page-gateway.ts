import { db } from '@/lib/db'
import type { PageInput } from '@/use-cases/pages/schemas'

export const pageGateway = {
  list: () =>
    db.page.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        slug: true,
        title: true,
        isHome: true,
        published: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    }),

  getById: (id: string) =>
    db.page.findFirst({
      where: { id, isActive: true },
    }),

  getBySlug: (slug: string) =>
    db.page.findFirst({
      where: { slug, isActive: true },
    }),

  getHome: () =>
    db.page.findFirst({
      where: { isHome: true, published: true, isActive: true },
    }),

  create: (data: PageInput) =>
    db.page.create({
      data: {
        ...data,
        blocks: data.blocks as unknown as Record<string, unknown>[],
      },
    }),

  update: (id: string, data: PageInput) =>
    db.page.update({
      where: { id },
      data: {
        ...data,
        blocks: data.blocks as unknown as Record<string, unknown>[],
      },
    }),

  softDelete: (id: string) =>
    db.page.update({
      where: { id },
      data: { isActive: false },
    }),

  existsBySlug: async (slug: string, excludeId?: string) => {
    const page = await db.page.findFirst({
      where: { slug, isActive: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    })
    return page !== null
  },
}
