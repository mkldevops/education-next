import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { setRequestLocale } from 'next-intl/server'
import { schoolGateway } from '@/gateways/school-gateway'
import { permanentRedirect } from '@/i18n/routing'

type Props = {
  params: Promise<{ locale: string }>
}

/**
 * Contournement mono-école, cohérent avec `school-switcher.tsx` : une seule école active
 * sur l'instance rend un sélecteur — ici une URL à choisir — inutile. `listActive()` est la
 * même source que le contournement du sélecteur, transposée au public puisqu'aucune session
 * n'existe ici pour porter des appartenances.
 *
 * Zéro ou plusieurs écoles actives : pas de page d'accueil multi-école dans ce lot, donc
 * `notFound()` plutôt qu'une redirection arbitraire vers l'une d'elles.
 */
export default async function EventsRedirectPage({ params }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)

  const schools = await schoolGateway.listActive()
  if (schools.length !== 1) notFound()

  permanentRedirect({ href: `/ecole/${schools[0].slug}/evenements`, locale })
}
