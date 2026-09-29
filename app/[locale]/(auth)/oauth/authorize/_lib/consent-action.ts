'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import { isImpersonating } from '@/domain/user'
import { localizedHref } from '@/i18n/localized-href'
import { appOrigin } from '@/lib/app-url'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { grantOAuthConsent } from '@/use-cases/mcp/oauth/grant-consent'
import {
  authorizationResponseUrl,
  validateAuthorizeRequest,
} from '@/use-cases/mcp/oauth/validate-authorize-request'
import { isMcpEnabled } from '@/use-cases/platform-settings/is-mcp-enabled'
import { authorizePath, pickAuthorizeQuery } from './authorize-query'

export type ConsentState = {
  error: 'forbidden' | 'invalidRequest' | 'impersonating' | 'mcpDisabled'
} | null

/**
 * Le seul geste qui crée une connexion. Tout est revérifié depuis le formulaire : la
 * session, l'emprunt d'identité, le drapeau plateforme, puis — dans le use case — le
 * client, l'URI, la ressource et le droit sur l'école choisie.
 *
 * Un refus explicite renvoie `access_denied` au client sur son URI enregistrée, jamais
 * sur une URI lue dans le formulaire.
 */
export async function consentAction(
  _previous: ConsentState,
  formData: FormData
): Promise<ConsentState> {
  const query = pickAuthorizeQuery(formData)
  const origin = appOrigin()

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    const locale = await getLocale()
    redirect(localizedHref(locale, `/login?redirectTo=${encodeURIComponent(authorizePath(query))}`))
  }

  if (formData.get('decision') === 'deny') {
    const validation = await validateAuthorizeRequest(query, origin)
    if (validation.status !== 'OK') return { error: 'invalidRequest' }

    redirect(
      authorizationResponseUrl(validation.request.redirect_uri, origin, {
        error: 'access_denied',
        state: validation.request.state,
      })
    )
  }

  // Une connexion accordée pendant un emprunt ouvrirait le MCP sous l'identité de la
  // cible, bien après la fin de la session empruntée.
  if (isImpersonating(session)) return { error: 'impersonating' }
  if (!(await isMcpEnabled())) return { error: 'mcpDisabled' }

  // `db.user` est soumis au soft-delete : un compte désactivé ne consent à rien.
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, isSuperAdmin: true },
  })
  if (!user) return { error: 'forbidden' }

  const schoolId = formData.get('schoolId')
  const result = await grantOAuthConsent({
    user,
    schoolId: typeof schoolId === 'string' ? schoolId : '',
    query,
    origin,
  })
  if (result.status !== 'OK') return { error: result.status }

  redirect(result.redirectTo)
}
