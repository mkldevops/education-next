import { setRequestLocale } from 'next-intl/server'
import { AuthShell } from '@/features/auth/auth-shell'
import { getBrandingConfig, resolveBrandingSchoolId } from '@/lib/branding'

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function AuthLayout({ children, params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  // Sans session, l'école vient du cookie posé par le dashboard : celle de la dernière visite.
  // Première visite : le shell affiche la marque plateforme neutre.
  const schoolId = await resolveBrandingSchoolId()
  const branding = schoolId ? await getBrandingConfig(schoolId) : null

  return (
    <AuthShell schoolName={branding?.schoolName} logoUrl={branding?.logoUrl}>
      {children}
    </AuthShell>
  )
}
