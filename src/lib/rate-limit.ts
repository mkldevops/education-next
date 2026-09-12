type RateLimiterOptions = { limit: number; windowMs: number; maxTrackedKeys?: number }

const DEFAULT_MAX_TRACKED_KEYS = 10_000
const DEFAULT_TRUSTED_PROXY_HOPS = 1
const MAX_TRUSTED_PROXY_HOPS = 4
const UNKNOWN_CLIENT = 'unknown'

/**
 * Nombre de proxys inverses de confiance devant l'application.
 *
 * Le défaut est `1` : l'image Docker sert `next start` derrière un proxy, jamais en
 * direct. `0` déclare qu'aucun en-tête de transfert n'est vérifiable et range donc tout
 * le trafic pré-auth dans un seul compteur.
 *
 * Lecture stricte, parce qu'une valeur mal formée décide ici d'une frontière de
 * confiance : `Number` accepterait `' '` comme `0` (un seul compteur pour l'instance
 * entière) et `'0x10'` comme seize sauts (le compte déclaré dépasse alors la chaîne
 * reçue, cf. `getClientIp`). Seule une suite de chiffres valant au plus
 * `MAX_TRUSTED_PROXY_HOPS` est retenue ; tout le reste retombe sur le défaut.
 */
function trustedProxyHops(): number {
  const raw = process.env.TRUSTED_PROXY_HOPS?.trim()
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_TRUSTED_PROXY_HOPS

  const hops = Number(raw)
  return hops <= MAX_TRUSTED_PROXY_HOPS ? hops : DEFAULT_TRUSTED_PROXY_HOPS
}

/**
 * `x-forwarded-for` ne se lit que par la droite.
 *
 * Chaque proxy ajoute l'adresse du pair dont il a reçu la requête : les `hops` dernières
 * entrées viennent de nos proxys, tout ce qui précède a été envoyé par le client et peut
 * être inventé. Prendre la première entrée laissait donc un attaquant faire tourner son
 * propre préfixe et s'offrir autant de compteurs que d'adresses imaginées. L'adresse du
 * pair de notre proxy le plus externe est à `length - hops`.
 *
 * Une chaîne plus courte que les sauts déclarés n'a pas traversé les proxys annoncés :
 * son contenu n'est plus attribuable, donc un seul compteur plutôt qu'une entrée choisie
 * par l'appelant. Même raison pour l'absence de repli sur `x-real-ip` : ce scalaire ne
 * porte aucun compte de sauts. `next start` renseigne lui-même `x-forwarded-for` depuis
 * l'adresse de la socket quand l'en-tête est absent
 * (`next/dist/server/base-server.js`, `??=`), donc le repli n'aurait servi que le cas où
 * l'appelant envoie un `x-forwarded-for` vide — exactement celui qu'il faut refuser.
 *
 * La garantie vaut pour un compte exact, chaque saut compté devant *ajouter* l'adresse
 * du pair. Sous-déclarer regroupe tout le monde derrière le proxy le plus externe ;
 * sur-déclarer est rétréci, pas fermé, puisqu'un appelant qui bourre la chaîne jusqu'à
 * `hops` entrées ramène l'index dans ce qu'il écrit lui-même.
 */
export function getClientIp(request: Request): string {
  const hops = trustedProxyHops()
  if (hops === 0) return UNKNOWN_CLIENT

  const chain = (request.headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((hop) => hop.trim())
    .filter(Boolean)

  return chain.length < hops ? UNKNOWN_CLIENT : chain[chain.length - hops]
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
