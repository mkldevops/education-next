/**
 * Cette route lit le cookie de session : elle porte donc une autorité ambiante, et un
 * site tiers pourrait la faire appeler par le navigateur d'un administrateur connecté.
 *
 * Deux barrières indépendantes, chacune suffisante seule :
 * - `content-type: application/json` — un formulaire HTML ne sait pas l'émettre, et le
 *   navigateur exige une pré-vérification CORS pour un `fetch` cross-origin qui le pose ;
 * - `sec-fetch-site` quand le navigateur l'envoie, sinon `origin` comparé à l'hôte
 *   servi (`x-forwarded-host` devant un proxy, `host` sinon).
 *
 * Le cookie de session est `SameSite=Lax`, ce qui ferme déjà le `POST` cross-site dans
 * les navigateurs récents ; la vérification ici ne dépend pas de ce réglage.
 */
export function isSameOriginJsonRequest(request: Request): boolean {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().startsWith('application/json')) return false

  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite) return fetchSite === 'same-origin' || fetchSite === 'none'

  const origin = request.headers.get('origin')
  if (origin === null) return true

  const served = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (!served) return false

  try {
    return new URL(origin).host === served.split(',')[0].trim()
  } catch {
    return false
  }
}
