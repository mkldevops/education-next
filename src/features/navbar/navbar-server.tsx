import { db } from '@/lib/db'
import { Navbar } from './navbar'

export async function NavbarServer() {
  const config = await db.config.findFirst({
    where: { name: 'logo_url', isActive: true },
    select: { value: true },
  })
  const logoUrl = config?.value || undefined

  return <Navbar logoUrl={logoUrl} />
}
