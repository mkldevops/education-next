import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthHeading } from '@/features/auth/auth-heading'
import { AuthShell } from '@/features/auth/auth-shell'
import { schoolGateway } from '@/gateways/school-gateway'
import { auth } from '@/lib/auth'
import { getBrandingConfig } from '@/lib/branding'
import { findInvitationByToken } from '@/lib/db-unscoped'
import { getThemeConfigs } from '@/lib/theme-configs'
import { AcceptInvitationForm } from './_components/accept-invitation-form'
import { InvitationStatus } from './_components/invitation-status'
import { JoinSchoolForm } from './_components/join-school-form'
import { findAccountByEmail } from './_lib/invited-email'
import { findInviterName } from './_lib/inviter-name'

type Props = {
  params: Promise<{ locale: string; token: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'auth.invite' })

  // Un lien d'invitation est personnel : il n'a rien à faire dans un index.
  return { title: t('metaTitle'), robots: { index: false, follow: false } }
}

export default async function InvitePage({ params }: Props) {
  await connection()
  const { locale, token } = await params
  setRequestLocale(locale)

  const invitation = await findInvitationByToken(token)
  const school = invitation ? await schoolGateway.findActiveById(invitation.schoolId) : null

  // Jeton inconnu ou école désactivée : même écran, sous la marque plateforme neutre,
  // pour ne rien laisser deviner de l'existence du jeton.
  if (!invitation || !school) {
    return (
      <AuthShell>
        <InvitationStatus status="invalid" />
      </AuthShell>
    )
  }

  const [branding, themeConfigs] = await Promise.all([
    getBrandingConfig(invitation.schoolId),
    getThemeConfigs(invitation.schoolId),
  ])
  const schoolName = school.name

  const shell = (children: React.ReactNode) => (
    <>
      <ThemeProvider configs={themeConfigs} />
      <AuthShell schoolName={schoolName} logoUrl={branding.logoUrl}>
        {children}
      </AuthShell>
    </>
  )

  if (invitation.usedAt) {
    return shell(<InvitationStatus status="used" schoolName={schoolName} />)
  }

  if (invitation.expiresAt < new Date()) {
    return shell(<InvitationStatus status="expired" schoolName={schoolName} />)
  }

  // Le détenteur du jeton connaît déjà l'adresse invitée : lui dire lequel des deux
  // parcours s'applique ne lui apprend rien qu'il ignore.
  const [t, existing, inviterName, session] = await Promise.all([
    getTranslations('auth.invite'),
    findAccountByEmail(invitation.email),
    findInviterName(invitation.createdById),
    auth.api.getSession({ headers: await headers() }),
  ])

  const role = invitation.role
  const description = inviterName
    ? t('invitedBy', { inviterName, schoolName, role })
    : t('invitedBySchool', { schoolName, role })

  return shell(
    <div className="space-y-8">
      <AuthHeading
        eyebrow={t('eyebrow')}
        title={t('title', { schoolName })}
        description={description}
      />
      {existing ? (
        <JoinSchoolForm
          token={token}
          email={invitation.email}
          schoolName={schoolName}
          signedInAs={session?.user?.email}
        />
      ) : (
        <AcceptInvitationForm token={token} email={invitation.email} />
      )}
    </div>
  )
}
