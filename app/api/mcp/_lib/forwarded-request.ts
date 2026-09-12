/**
 * En-têtes porteurs d'un secret, retirés avant que la requête n'atteigne le SDK.
 *
 * `authorization` et `x-api-key` sont les deux noms sous lesquels `readMcpCredential`
 * accepte la clé ; `cookie` et `proxy-authorization` n'ont rien à faire ici mais coûtent
 * moins à retirer qu'à raisonner.
 */
const CREDENTIAL_HEADERS = ['authorization', 'x-api-key', 'cookie', 'proxy-authorization']

/**
 * Le même invariant que `toAuthInfo`, un cran plus haut : la clé présentée ne franchit pas
 * la frontière du SDK.
 *
 * `createMcpHandler` passe la `Request` reçue à la factory de serveur (`requestInfo`) et au
 * contexte d'exécution de chaque outil — elle est donc aussi lisible, et aussi sérialisable
 * dans une erreur, qu'`AuthInfo`. La route ne peut pas transmettre l'originale.
 *
 * Retrait plutôt qu'allowlist : le jeu d'en-têtes exigé par le SDK (`accept`,
 * `content-type`, `mcp-protocol-version`, `mcp-session-id`, `mcp-method`, `mcp-name`,
 * `last-event-id`, `Mcp-Param-*`) est interne au protocole et bouge avec lui. Un en-tête
 * oublié dans une allowlist ne casserait pas la compilation, il produirait un 406 ou un 400
 * à l'exécution. L'invariant à garantir est « aucune authentification ne passe », pas
 * « seuls ces en-têtes passent ».
 */
export function withoutCredentials(request: Request): Request {
  const headers = new Headers(request.headers)
  for (const name of CREDENTIAL_HEADERS) headers.delete(name)

  return new Request(request, { headers })
}
