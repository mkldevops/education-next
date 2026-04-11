import { db } from '@/lib/db'

export async function getBrandingContacts() {
  const configs = await db.config.findMany({
    where: {
      name: { in: ['school_email', 'school_phone', 'school_address'] },
      isActive: true,
    },
    select: { name: true, value: true },
  })

  return {
    email: configs.find((c) => c.name === 'school_email')?.value,
    phone: configs.find((c) => c.name === 'school_phone')?.value,
    address: configs.find((c) => c.name === 'school_address')?.value,
  }
}
