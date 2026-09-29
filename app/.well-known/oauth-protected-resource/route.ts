import { protectedResourceMetadata } from '@/domain/mcp-oauth'
import { appOrigin } from '@/lib/app-url'
import { oauthJson, oauthPreflight } from '../../api/mcp/oauth/_lib/oauth-http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * RFC 9728. La variante par chemin (`/.well-known/oauth-protected-resource/api/mcp`)
 * sert le même document : un client peut dériver l'une ou l'autre de l'URL MCP.
 */
export function GET() {
  return oauthJson(protectedResourceMetadata(appOrigin()))
}

export function OPTIONS() {
  return oauthPreflight()
}
