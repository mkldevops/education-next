import { db } from '@/lib/db'

export const userGateway = {
  findById: (id: string) =>
    db.user.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    }),
}
