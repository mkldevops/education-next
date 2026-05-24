import { getBrandingConfig } from '@/lib/branding'
import { Navbar } from './navbar'

export async function NavbarServer() {
  const { logoUrl } = await getBrandingConfig()

  return <Navbar logoUrl={logoUrl} />
}
