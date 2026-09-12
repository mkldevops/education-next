type RateLimiterOptions = { limit: number; windowMs: number; maxTrackedKeys?: number }

const DEFAULT_MAX_TRACKED_KEYS = 10_000
const DEFAULT_TRUSTED_PROXY_HOPS = 1
const UNKNOWN_CLIENT = 'unknown'

/**
 * Nombre de proxys inverses de confiance devant l'application.
 *
 * Le défaut est `1` : l'image Docker sert `next start` derrière un proxy, jamais en
 * direct. `0` déclare qu'aucun en-tête de transfert n'est vérifiable et range donc tout
 * le trafic pré-auth dans un seul compteur — utile pour un exposant direct, au prix de
 * la granularité.
 */
function trustedProxyHops(): number {
  const raw = process.env.TRUSTED_PROXY_HOPS
  if (!raw) return DEFAULT_TRUSTED_PROXY_HOPS

  const hops = Number(raw)
  return Number.isInteger(hops) && hops >= 0 ? hops : DEFAULT_TRUSTED_PROXY_HOPS
}

/**
 * `x-forwarded-for` ne se lit que par la droite.
 *
 * Chaque proxy ajoute l'adresse du pair dont il a reçu la requête : les `hops` dernières
 * entrées viennent de nos proxys, tout ce qui précède a été envoyé par le client et peut
 * être inventé. Prendre la première entrée laissait donc un attaquant faire tourner son
 * propre préfixe et s'offrir autant de compteurs que d'adresses imaginées. L'adresse du
 * pair de notre proxy le plus externe est à `length - hops`, bornée à `0` quand la chaîne
 * est plus courte que les sauts déclarés — toutes ses entrées sont alors les nôtres.
 */
export function getClientIp(request: Request): string {
  const hops = trustedProxyHops()
  if (hops === 0) return UNKNOWN_CLIENT

  const chain = (request.headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((hop) => hop.trim())
    .filter(Boolean)

  return (
    chain[Math.max(0, chain.length - hops)] ||
    request.headers.get('x-real-ip')?.trim() ||
    UNKNOWN_CLIENT
  )
}

/**
 * Fenêtre glissante en mémoire. Le déploiement est un `next start` long-vivant : le
 * compteur survit aux requêtes. Il ne survit pas à une mise à l'échelle horizontale —
 * n étages en parallèle laissent passer n fois le budget.
 */
export function createRateLimiter({
  limit,
  windowMs,
  maxTrackedKeys = DEFAULT_MAX_TRACKED_KEYS,
}: RateLimiterOptions) {
  const timestamps = new Map<string, number[]>()

  return function isRateLimited(key: string): boolean {
    const now = Date.now()
    const recent = (timestamps.get(key) ?? []).filter((t) => now - t < windowMs)
    const limited = recent.length >= limit
    if (!limited) recent.push(now)

    // `Map.set` sur une clé existante ne déplace pas sa position : sans le `delete`,
    // l'ordre d'itération reste celui des insertions et l'éviction frappe le client
    // établi avant l'adresse qui vient d'apparaître. Réécrire même sur un refus est ce
    // qui empêche une clé bloquée de se faire évincer pour repartir à zéro.
    timestamps.delete(key)
    timestamps.set(key, recent)

    if (timestamps.size > maxTrackedKeys) {
      const leastRecentlyUsed = timestamps.keys().next().value
      if (leastRecentlyUsed !== undefined) timestamps.delete(leastRecentlyUsed)
    }
    return limited
  }
}
