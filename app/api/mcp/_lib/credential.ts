/**
 * Clé présentée par l'appelant.
 *
 * `Authorization: Bearer` d'abord, `X-API-Key` en repli : sur une connexion gérée par
 * le client, `Authorization` peut être réservé au flux OAuth de ce client, et seul un
 * en-tête nommé autrement reste disponible.
 */
export function readMcpCredential(headers: Headers): string | null {
  const authorization = headers.get('authorization')
  if (authorization) {
    const [scheme, ...rest] = authorization.trim().split(/\s+/)
    if (scheme?.toLowerCase() === 'bearer' && rest.length === 1) return rest[0] ?? null
    return null
  }

  return headers.get('x-api-key')?.trim() || null
}
