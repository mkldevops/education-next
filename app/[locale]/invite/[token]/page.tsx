import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { setRequestLocale } from 'next-intl/server'
import { db } from '@/lib/db'
import { AcceptInvitationForm } from './_components/accept-invitation-form'

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

  const invitation = await db.invitation.findUnique({
    where: { token },
  })

  if (!invitation) notFound()

  if (invitation.usedAt) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="max-w-md rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <h1 className="text-lg font-semibold text-red-800">Lien déjà utilisé</h1>
          <p className="mt-2 text-sm text-red-600">Ce lien d'invitation a déjà été utilisé.</p>
        </div>
      </div>
    )
  }

  if (invitation.expiresAt < new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="max-w-md rounded-xl border border-orange-200 bg-orange-50 p-8 text-center">
          <h1 className="text-lg font-semibold text-orange-800">Lien expiré</h1>
          <p className="mt-2 text-sm text-orange-600">Ce lien d'invitation a expiré.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <AcceptInvitationForm token={token} email={invitation.email} />
      </div>
    </div>
  )
}
