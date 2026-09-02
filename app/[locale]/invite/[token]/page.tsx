import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { setRequestLocale } from 'next-intl/server'
import { schoolGateway } from '@/gateways/school-gateway'
import { auth } from '@/lib/auth'
import { findInvitationByToken } from '@/lib/db-unscoped'
import { AcceptInvitationForm } from './_components/accept-invitation-form'
import { JoinSchoolForm } from './_components/join-school-form'
import { findAccountByEmail } from './_lib/invited-email'

type Props = {
  params: Promise<{ locale: string; token: string }>
}

export const metadata: Metadata = {
  title: 'Créer votre compte',
}

export default async function InvitePage({ params }: Props) {
  await connection()
  const { locale, token } = await params
  setRequestLocale(locale)

  const invitation = await findInvitationByToken(token)

  if (!invitation) notFound()

  if (invitation.usedAt) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="max-w-md rounded border border-red-200 bg-red-50 p-8 text-center">
          <h1 className="text-lg font-semibold text-red-800">Lien déjà utilisé</h1>
          <p className="mt-2 text-sm text-red-600">Ce lien d'invitation a déjà été utilisé.</p>
        </div>
      </div>
    )
  }

  if (invitation.expiresAt < new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="max-w-md rounded border border-orange-200 bg-orange-50 p-8 text-center">
          <h1 className="text-lg font-semibold text-orange-800">Lien expiré</h1>
          <p className="mt-2 text-sm text-orange-600">Ce lien d'invitation a expiré.</p>
        </div>
      </div>
    )
  }

  // Le détenteur du jeton connaît déjà l'adresse invitée : lui dire lequel des deux
  // parcours s'applique ne lui apprend rien qu'il ignore.
  const [existing, school, session] = await Promise.all([
    findAccountByEmail(invitation.email),
    schoolGateway.findActiveById(invitation.schoolId),
    auth.api.getSession({ headers: await headers() }),
  ])

  if (!school) notFound()

  return (
    <div className="flex min-h-screen items-center justify-center bg-alabaster-900">
      <div className="w-full max-w-md">
        {existing ? (
          <JoinSchoolForm
            token={token}
            email={invitation.email}
            schoolName={school.name}
            signedInAs={session?.user?.email}
          />
        ) : (
          <AcceptInvitationForm token={token} email={invitation.email} />
        )}
      </div>
    </div>
  )
}
