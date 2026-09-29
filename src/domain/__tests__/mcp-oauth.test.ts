import { describe, expect, it } from 'vitest'
import {
  accessTokenExpiry,
  authorizationServerMetadata,
  authorizeRequestSchema,
  codeExpiry,
  isAcceptableRedirectUri,
  isGrantUsable,
  isSameResource,
  isTokenUsable,
  isWellFormedAccessToken,
  isWellFormedAuthorizationCode,
  isWellFormedRefreshToken,
  MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS,
  MCP_OAUTH_CODE_TTL_SECONDS,
  MCP_OAUTH_SCOPE,
  mcpOAuthPrefix,
  mcpResourceUrl,
  pkceMatches,
  protectedResourceMetadata,
  protectedResourceMetadataUrl,
  refreshTokenExpiry,
  registerClientSchema,
} from '../mcp-oauth'

const body = 'a'.repeat(43)

describe('secret shapes', () => {
  it('tells the three secrets apart by prefix and refuses the API key shape', () => {
    expect(isWellFormedAccessToken(`edu_oat_${body}`)).toBe(true)
    expect(isWellFormedRefreshToken(`edu_ort_${body}`)).toBe(true)
    expect(isWellFormedAuthorizationCode(`edu_oac_${body}`)).toBe(true)

    expect(isWellFormedAccessToken(`edu_ort_${body}`)).toBe(false)
    expect(isWellFormedAccessToken(`edu_mcp_${body}`)).toBe(false)
    expect(isWellFormedAccessToken(`edu_oat_${'a'.repeat(42)}`)).toBe(false)
    expect(isWellFormedAccessToken(`edu_oat_${body}=`)).toBe(false)
  })

  it('keeps a twelve-character prefix as the only stored fragment', () => {
    expect(mcpOAuthPrefix(`edu_oat_${body}`)).toBe('edu_oat_aaaa')
  })
})

describe('lifecycle', () => {
  const now = new Date('2026-09-29T10:00:00Z')
  const live = { expiresAt: new Date('2026-09-29T11:00:00Z'), consumedAt: null, revokedAt: null }

  it('refuses a consumed, revoked or expired token alike', () => {
    expect(isTokenUsable(live, now)).toBe(true)
    expect(isTokenUsable({ ...live, consumedAt: now }, now)).toBe(false)
    expect(isTokenUsable({ ...live, revokedAt: now }, now)).toBe(false)
    expect(isTokenUsable({ ...live, expiresAt: now }, now)).toBe(false)
  })

  it('treats a grant as dead once revoked', () => {
    expect(isGrantUsable({ revokedAt: null })).toBe(true)
    expect(isGrantUsable({ revokedAt: now })).toBe(false)
  })

  it('derives the three lifetimes from the same clock', () => {
    expect(codeExpiry(now).getTime() - now.getTime()).toBe(MCP_OAUTH_CODE_TTL_SECONDS * 1000)
    expect(accessTokenExpiry(now).getTime() - now.getTime()).toBe(
      MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS * 1000
    )
    expect(refreshTokenExpiry(now).toISOString()).toBe('2026-10-29T10:00:00.000Z')
  })
})

describe('resource (audience)', () => {
  it('names the MCP route of the configured origin, path and port included', () => {
    expect(mcpResourceUrl('https://ecole-a.example')).toBe('https://ecole-a.example/api/mcp')
    expect(mcpResourceUrl('http://localhost:8550/some/path')).toBe('http://localhost:8550/api/mcp')
  })

  it('accepts a trailing slash but nothing else', () => {
    const expected = 'https://ecole-a.example/api/mcp'
    expect(isSameResource('https://ecole-a.example/api/mcp/', expected)).toBe(true)
    expect(isSameResource('https://ecole-a.example/api/mcp', expected)).toBe(true)
    expect(isSameResource('https://ecole-b.example/api/mcp', expected)).toBe(false)
    expect(isSameResource('http://ecole-a.example/api/mcp', expected)).toBe(false)
    expect(isSameResource('https://ecole-a.example/api/mcp?x=1', expected)).toBe(false)
    expect(isSameResource('https://ecole-a.example/api/mcp#f', expected)).toBe(false)
    expect(isSameResource('not a url', expected)).toBe(false)
  })
})

describe('redirect URIs', () => {
  it('allows https anywhere and http on the loopback only', () => {
    expect(isAcceptableRedirectUri('https://chatgpt.com/connector_platform_oauth_redirect')).toBe(
      true
    )
    expect(isAcceptableRedirectUri('http://localhost:6274/oauth/callback')).toBe(true)
    expect(isAcceptableRedirectUri('http://127.0.0.1/cb')).toBe(true)
    expect(isAcceptableRedirectUri('http://chatgpt.com/cb')).toBe(false)
    expect(isAcceptableRedirectUri('https://chatgpt.com/cb#fragment')).toBe(false)
    expect(isAcceptableRedirectUri('javascript:alert(1)')).toBe(false)
    expect(isAcceptableRedirectUri('nope')).toBe(false)
  })
})

describe('PKCE', () => {
  const sha = (value: string) => `sha(${value})`

  it('checks the verifier shape before hashing', () => {
    expect(pkceMatches('v'.repeat(43), `sha(${'v'.repeat(43)})`, sha)).toBe(true)
    expect(pkceMatches('v'.repeat(43), 'other', sha)).toBe(false)
    expect(pkceMatches('short', 'sha(short)', sha)).toBe(false)
    expect(pkceMatches('v'.repeat(129), `sha(${'v'.repeat(129)})`, sha)).toBe(false)
  })
})

describe('schemas', () => {
  const valid = {
    response_type: 'code',
    client_id: '4d5c0a4a-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
    redirect_uri: 'https://chatgpt.com/connector_platform_oauth_redirect',
    code_challenge: 'c'.repeat(43),
    code_challenge_method: 'S256',
  }

  it('reads the only scope, lets it default and refuses any other', () => {
    expect(authorizeRequestSchema.parse(valid).scope).toEqual([])
    expect(authorizeRequestSchema.parse({ ...valid, scope: MCP_OAUTH_SCOPE }).scope).toEqual([
      MCP_OAUTH_SCOPE,
    ])
    expect(authorizeRequestSchema.safeParse({ ...valid, scope: 'offline_access' }).success).toBe(
      false
    )
  })

  it('insists on S256', () => {
    expect(
      authorizeRequestSchema.safeParse({ ...valid, code_challenge_method: 'plain' }).success
    ).toBe(false)
  })

  it('registers a public client only', () => {
    const client = { client_name: 'ChatGPT', redirect_uris: [valid.redirect_uri] }
    expect(registerClientSchema.safeParse(client).success).toBe(true)
    expect(
      registerClientSchema.safeParse({
        ...client,
        token_endpoint_auth_method: 'client_secret_post',
      }).success
    ).toBe(false)
    expect(registerClientSchema.safeParse({ ...client, redirect_uris: [] }).success).toBe(false)
    expect(
      registerClientSchema.safeParse({ ...client, grant_types: ['client_credentials'] }).success
    ).toBe(false)
  })
})

describe('metadata', () => {
  it('announces PKCE S256, public clients and every endpoint on the configured origin', () => {
    const metadata = authorizationServerMetadata('https://ecole-a.example/')

    expect(metadata).toMatchObject({
      issuer: 'https://ecole-a.example',
      authorization_endpoint: 'https://ecole-a.example/oauth/authorize',
      token_endpoint: 'https://ecole-a.example/api/mcp/oauth/token',
      registration_endpoint: 'https://ecole-a.example/api/mcp/oauth/register',
      revocation_endpoint: 'https://ecole-a.example/api/mcp/oauth/revoke',
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      authorization_response_iss_parameter_supported: true,
    })
  })

  it('points the resource at its own issuer', () => {
    expect(protectedResourceMetadata('https://ecole-a.example')).toEqual({
      resource: 'https://ecole-a.example/api/mcp',
      authorization_servers: ['https://ecole-a.example'],
      scopes_supported: [MCP_OAUTH_SCOPE],
      bearer_methods_supported: ['header'],
    })
    expect(protectedResourceMetadataUrl('https://ecole-a.example')).toBe(
      'https://ecole-a.example/.well-known/oauth-protected-resource'
    )
  })
})
