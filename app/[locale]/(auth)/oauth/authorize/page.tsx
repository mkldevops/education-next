import { buttonVariants, cn } from '@peaklab/ui'
import { ShieldAlert } from 'lucide-react'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AuthHeading } from '@/features/auth/auth-heading'
import { schoolGateway } from '@/gateways/school-gateway'
import { schoolMemberGateway } from '@/gateways/school-member-gateway'
import { localizedHref } from '@/i18n/localized-href'
import { appOrigin } from '@/lib/app-url'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  authorizationResponseUrl,
  validateAuthorizeRequest,
} from '@/use-cases/mcp/oauth/validate-authorize-request'
import { isMcpEnabled } from '@/use-cases/platform-settings/is-mcp-enabled'
import { ConsentForm } from './_components/consent-form'
import { authorizePath, pickAuthorizeQuery } from './_lib/authorize-query'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'auth.oauth' })

  return { title: t('title') }
}

/**
 * Point de terminaison d'autorisation (RFC 6749 §3.1) : c'est l'écran de consentement.
 *
 * L'ordre des vérifications est celui de la RFC : client et URI d'abord, sans quoi il
 * n'y a personne à qui rapporter une erreur ; puis les autres paramètres, dont l'erreur
 * est rapportée au client par un lien que l'utilisateur suit lui-même — un client
 * enregistré anonymement n'est pas assez sûr pour une redirection automatique, qui
 * ferait de cette page un redirecteur ouvert (RFC 9700 §4.11) ; puis la session, rejouée
 * après connexion avec la même requête ; enfin les écoles que l'utilisateur administre —
 * c'est lui qui en choisit une.
 */
export default async function OAuthAuthorizePage({ params, searchParams }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations('auth.oauth')
  const query = pickAuthorizeQuery(await searchParams)
  const origin = appOrigin()

  const validation = await validateAuthorizeRequest(query, origin)
  if (validation.status === 'rejected') {
    return <Rejected title={t('errors.title')} description={t(`errors.${validation.reason}`)} />
  }
  if (validation.status === 'redirectError') {
    const returnUrl = authorizationResponseUrl(validation.redirectUri, origin, {
      error: validation.error,
      state: validation.state,
    })
    return (
      <div className="space-y-6">
        <Rejected title={t('errors.title')} description={t('errors.invalidRequest')} />
        <a href={returnUrl} className={cn(buttonVariants({ variant: 'outline' }))}>
          {t('errors.returnToClient', { host: new URL(validation.redirectUri).host })}
        </a>
      </div>
    )
  }

  if (!(await isMcpEnabled())) {
    return <Rejected title={t('errors.title')} description={t('errors.mcpDisabled')} />
  }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    redirect(localizedHref(locale, `/login?redirectTo=${encodeURIComponent(authorizePath(query))}`))
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { isSuperAdmin: true },
  })
  const schools = !user
    ? []
    : user.isSuperAdmin
      ? await schoolGateway.listActive()
      : (await schoolMemberGateway.listAuthorizedSchools(session.user.id))
          .filter((membership) => membership.role === 'ADMIN')
          .map((membership) => membership.school)

  const { client, request } = validation
  const callbackHost = new URL(request.redirect_uri).host

  return (
    <div className="space-y-8">
      <AuthHeading
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('subtitle', { clientName: client.clientName })}
      />

      <ConsentForm
        query={query}
        schools={schools}
        account={session.user.email}
        clientName={client.clientName}
        callbackHost={callbackHost}
      />
    </div>
  )
}

function Rejected({ title, description }: { title: string; description: string }) {
  return (
    <AuthHeading tone="danger" icon={<ShieldAlert />} title={title} description={description} />
  )
}
