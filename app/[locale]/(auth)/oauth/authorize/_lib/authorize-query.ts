/** Paramètres qu'une requête `/oauth/authorize` peut porter, et qui sont rejoués au consentement. */
export const AUTHORIZE_PARAMS = [
  'response_type',
  'client_id',
  'redirect_uri',
  'code_challenge',
  'code_challenge_method',
  'state',
  'scope',
  'resource',
] as const

export type AuthorizeQuery = Record<(typeof AUTHORIZE_PARAMS)[number], string | undefined>

const MAX_PARAM_LENGTH = 2048

function first(value: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value
  return candidate !== undefined && candidate.length <= MAX_PARAM_LENGTH ? candidate : undefined
}

/** Ne retient que les paramètres connus : un formulaire ou une URL n'en injecte pas d'autres. */
export function pickAuthorizeQuery(
  source: Record<string, string | string[] | undefined> | FormData
): AuthorizeQuery {
  const read = (name: string) =>
    source instanceof FormData
      ? first(source.getAll(name).filter((entry): entry is string => typeof entry === 'string'))
      : first(source[name])

  return Object.fromEntries(AUTHORIZE_PARAMS.map((name) => [name, read(name)])) as AuthorizeQuery
}

/** Chemin interne à rejouer après connexion : la même requête, sans rien perdre. */
export function authorizePath(query: AuthorizeQuery): string {
  const params = new URLSearchParams()
  for (const name of AUTHORIZE_PARAMS) {
    const value = query[name]
    if (value !== undefined) params.set(name, value)
  }
  return `/oauth/authorize?${params.toString()}`
}
