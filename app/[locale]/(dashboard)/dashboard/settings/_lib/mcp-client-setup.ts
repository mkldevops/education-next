export const MCP_CLIENTS = ['claudeCode', 'codex', 'claudeWeb', 'chatgpt'] as const

export type McpClient = (typeof MCP_CLIENTS)[number]

/**
 * `ready` : le client accepte l'en-tête `Authorization` de la clé. `headersBeta` : la clé passe
 * par les en-têtes de requête du connecteur, une bêta que tous les comptes n'ont pas.
 * `oauthRequired` : le client ne se connecte que par OAuth, que le serveur n'offre pas encore
 * (#393) — la clé seule n'y suffit pas.
 */
export type McpClientStatus = 'ready' | 'headersBeta' | 'oauthRequired'

export const MCP_CLIENT_STATUS: Record<McpClient, McpClientStatus> = {
  claudeCode: 'ready',
  codex: 'ready',
  claudeWeb: 'headersBeta',
  chatgpt: 'oauthRequired',
}

export type McpSite = {
  host: string
  url: string
  serverName: string
  tokenEnvVar: string
}

/**
 * Le nom du serveur et la variable du jeton portent l'hôte du site : deux déploiements
 * configurés sur le même poste restent distincts et reconnaissables.
 */
export function mcpSite(origin: string): McpSite {
  const { host, origin: base } = new URL(origin)
  const slug = host
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return {
    host,
    url: `${base}/api/mcp`,
    serverName: `education-${slug}`,
    tokenEnvVar: `EDUCATION_MCP_TOKEN_${slug.replace(/-/g, '_').toUpperCase()}`,
  }
}

export function claudeCodeCommand(site: McpSite, key: string) {
  return `claude mcp add --transport http ${site.serverName} ${site.url} --header "Authorization: Bearer ${key}"`
}

export function codexConfig(site: McpSite) {
  return [
    `[mcp_servers.${site.serverName}]`,
    `url = "${site.url}"`,
    `bearer_token_env_var = "${site.tokenEnvVar}"`,
  ].join('\n')
}

export function codexTokenExport(site: McpSite, key: string) {
  return `export ${site.tokenEnvVar}="${key}"`
}
