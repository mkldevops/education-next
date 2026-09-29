import { authorizationServerMetadata } from '@/domain/mcp-oauth'
import { appOrigin } from '@/lib/app-url'
import { oauthJson, oauthPreflight } from '../../api/mcp/oauth/_lib/oauth-http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** RFC 8414. Hors `proxy.ts` : son matcher exclut tout chemin qui contient un point. */
export function GET() {
  return oauthJson(authorizationServerMetadata(appOrigin()))
}

export function OPTIONS() {
  return oauthPreflight()
}
