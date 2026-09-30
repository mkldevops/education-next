import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MCP_DRAFT_CHECKSUM_LENGTH } from '@/domain/mcp-draft'
import { hashMcpKey } from '@/lib/mcp-key-crypto'

/**
 * Le chemin complet d'un appel ChatGPT, sans base : jeton d'accès OAuth → résolution de
 * portée → SDK MCP réel → use case. Seules les passerelles et les use cases appelés sont
 * doublés ; `createMcpHandler` et `buildMcpServer` sont les vrais.
 */
const SITE_A = 'https://ecole-a.example'
const SITE_B = 'https://ecole-b.example'

const accessToken = `edu_oat_${'a'.repeat(43)}`
const otherSiteToken = `edu_oat_${'b'.repeat(43)}`
const revokedToken = `edu_oat_${'c'.repeat(43)}`
const apiKey = `edu_mcp_${'k'.repeat(43)}`

const grant: {
  id: string
  schoolId: string
  userId: string
  clientId: string
  clientName: string
  resource: string
  lastUsedAt: Date | null
  revokedAt: Date | null
  createdAt: Date
} = {
  id: 'grant-1',
  schoolId: 'school-1',
  userId: 'user-1',
  clientId: '4d5c0a4a-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
  clientName: 'ChatGPT',
  resource: `${SITE_A}/api/mcp`,
  lastUsedAt: null,
  revokedAt: null,
  createdAt: new Date('2026-09-29T09:00:00Z'),
}

function tokenRow(id: string, grantOverrides: Partial<typeof grant> = {}) {
  return {
    id,
    kind: 'ACCESS' as const,
    grantId: grant.id,
    codeChallenge: null,
    redirectUri: null,
    expiresAt: new Date(Date.now() + 3_600_000),
    consumedAt: null,
    revokedAt: null,
    grant: { ...grant, ...grantOverrides },
  }
}

const tokenRows: Record<string, ReturnType<typeof tokenRow>> = {
  [hashMcpKey(accessToken)]: tokenRow('token-a'),
  [hashMcpKey(otherSiteToken)]: tokenRow('token-b', {
    id: 'grant-2',
    resource: `${SITE_B}/api/mcp`,
  }),
  [hashMcpKey(revokedToken)]: tokenRow('token-c', {
    id: 'grant-3',
    revokedAt: new Date('2026-09-29T10:00:00Z'),
  }),
}

const keyRow = {
  id: 'key-1',
  schoolId: 'school-1',
  userId: 'user-1',
  prefix: 'edu_mcp_kkkk',
  expiresAt: new Date(Date.now() + 86_400_000),
  revokedAt: null,
  lastUsedAt: null,
}

const afterMock = vi.fn()
const findTokenByHash = vi.fn()
const grantTouch = vi.fn()
const findByHash = vi.fn()
const keyTouch = vi.fn()
const findPlatformLevel = vi.fn()
const findActiveById = vi.fn()
const findMembership = vi.fn()
const describeSchool = vi.fn()
const previewEnrollFamily = vi.fn()
const commitEnrollFamily = vi.fn()

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (callback: () => unknown) => afterMock(callback),
}))
vi.mock('@/gateways/mcp-oauth-grant-gateway', () => ({
  mcpOAuthGrantGateway: { findTokenByHash, touch: grantTouch },
}))
vi.mock('@/gateways/mcp-api-key-gateway', () => ({
  mcpApiKeyGateway: { findByHash, touch: keyTouch },
}))
vi.mock('@/gateways/user-gateway', () => ({ userGateway: { findPlatformLevel } }))
vi.mock('@/gateways/school-gateway', () => ({ schoolGateway: { findActiveById } }))
vi.mock('@/gateways/school-member-gateway', () => ({
  schoolMemberGateway: { findMembership },
}))
vi.mock('@/gateways/mcp-read-gateway', () => ({ mcpReadGateway: { describeSchool } }))
vi.mock('@/use-cases/config/is-payments-enabled', () => ({
  isPaymentsEnabled: async () => true,
}))
vi.mock('@/use-cases/platform-settings/is-mcp-enabled', () => ({
  isMcpEnabled: async () => true,
}))
vi.mock('@/use-cases/mcp/purge-expired-drafts', () => ({ purgeExpiredDrafts: vi.fn() }))
vi.mock('@/use-cases/mcp/oauth/purge-expired-tokens', () => ({
  purgeExpiredOAuthTokens: vi.fn(),
}))
vi.mock('@/use-cases/mcp/preview-enroll-family', () => ({ previewEnrollFamily }))
vi.mock('@/use-cases/mcp/commit-enroll-family', () => ({ commitEnrollFamily }))

vi.stubEnv('NEXT_PUBLIC_APP_URL', SITE_A)

const { POST } = await import('../route')

let requestSeq = 0

function rpc(method: string, params: Record<string, unknown> = {}) {
  requestSeq += 1
  return { jsonrpc: '2.0', id: requestSeq, method, params }
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request(`${SITE_A}/api/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-protocol-version': '2025-06-18',
        'x-forwarded-for': '203.0.113.7',
        ...headers,
      },
      body: JSON.stringify(body),
    })
  )
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` })

/** Le SDK répond en JSON ou en SSE selon l'`accept` ; un seul message dans les deux cas. */
async function readRpc(response: Response) {
  const text = await response.text()
  const data = text
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
  return JSON.parse(data.length > 0 ? data[data.length - 1] : text)
}

async function callTool(token: string, name: string, args: Record<string, unknown> = {}) {
  const response = await post(rpc('tools/call', { name, arguments: args }), bearer(token))
  expect(response.status).toBe(200)
  const { result } = await readRpc(response)
  return { ...result, payload: JSON.parse(result.content[0].text) }
}

const expectedScope = {
  credentialId: 'grant-1',
  credentialPrefix: 'edu_oat_aaaa',
  owner: { kind: 'OAUTH_GRANT', grantId: 'grant-1' },
  userId: 'user-1',
  schoolId: 'school-1',
  isSuperAdmin: false,
  paymentsEnabled: true,
}

beforeEach(() => {
  vi.clearAllMocks()
  findTokenByHash.mockImplementation(async (hash: string) => tokenRows[hash] ?? null)
  findByHash.mockImplementation(async (hash: string) =>
    hash === hashMcpKey(apiKey) ? keyRow : null
  )
  findPlatformLevel.mockResolvedValue({ id: 'user-1', isSuperAdmin: false })
  findActiveById.mockResolvedValue({ id: 'school-1', name: 'École A', slug: 'ecole-a' })
  findMembership.mockResolvedValue({ userId: 'user-1', schoolId: 'school-1', role: 'ADMIN' })
  describeSchool.mockResolvedValue({ id: 'school-1', name: 'École A' })
  previewEnrollFamily.mockResolvedValue({
    draftId: '9d1e2c3b-4a5f-4d6e-8b7c-0f1e2d3c4b5a',
    checksum: 'x'.repeat(MCP_DRAFT_CHECKSUM_LENGTH),
  })
  commitEnrollFamily.mockResolvedValue({ familyId: 'family-1' })
})

describe('MCP transport through an OAuth access token', () => {
  it('refuses an anonymous call and says where to authorize', async () => {
    const response = await post(rpc('tools/list'))

    expect(response.status).toBe(401)
    expect(response.headers.get('www-authenticate')).toBe(
      `Bearer resource_metadata="${SITE_A}/.well-known/oauth-protected-resource"`
    )
    expect(findTokenByHash).not.toHaveBeenCalled()
  })

  it('lists the school tools for a live connection', async () => {
    const response = await post(rpc('tools/list'), bearer(accessToken))

    expect(response.status).toBe(200)
    const { result } = await readRpc(response)
    const names = result.tools.map((tool: { name: string }) => tool.name)
    expect(names).toEqual(
      expect.arrayContaining(['describe_school', 'preview_enroll_family', 'commit_enroll_family'])
    )
    expect(findTokenByHash).toHaveBeenCalledWith(hashMcpKey(accessToken))
    expect(findTokenByHash).not.toHaveBeenCalledWith(accessToken)
  })

  it('runs a read tool on the school of the grant, not on one named by the caller', async () => {
    const { payload, isError } = await callTool(accessToken, 'describe_school', {
      schoolId: 'school-2',
    })

    expect(isError).toBeUndefined()
    expect(payload).toEqual({ id: 'school-1', name: 'École A' })
    expect(describeSchool).toHaveBeenCalledWith('school-1')
  })

  it('carries the OAuth scope into the preview and commit pair', async () => {
    const preview = await callTool(accessToken, 'preview_enroll_family', {
      familyName: 'Durand',
      students: [{ name: 'Lina', lastname: 'Durand', className: 'CP' }],
    })
    expect(preview.isError).toBeUndefined()
    expect(previewEnrollFamily).toHaveBeenCalledWith(
      expectedScope,
      expect.objectContaining({ familyName: 'Durand' })
    )

    const commit = await callTool(accessToken, 'commit_enroll_family', {
      draftId: preview.payload.draftId,
      checksum: preview.payload.checksum,
    })
    expect(commit.payload).toEqual({ familyId: 'family-1' })
    expect(commitEnrollFamily).toHaveBeenCalledWith(expectedScope, {
      draftId: preview.payload.draftId,
      checksum: preview.payload.checksum,
    })
  })

  it('refuses a commit with a malformed checksum before the use case', async () => {
    const response = await post(
      rpc('tools/call', {
        name: 'commit_enroll_family',
        arguments: { draftId: 'not-a-uuid', checksum: 'short' },
      }),
      bearer(accessToken)
    )

    expect(response.status).toBe(200)
    const body = await readRpc(response)
    expect(body.error ?? body.result?.isError).toBeTruthy()
    expect(commitEnrollFamily).not.toHaveBeenCalled()
  })

  it('refuses a token issued by another site as unauthenticated', async () => {
    const response = await post(rpc('tools/list'), bearer(otherSiteToken))

    expect(response.status).toBe(401)
    expect(response.headers.get('www-authenticate')).toContain('error="invalid_token"')
    expect(findPlatformLevel).not.toHaveBeenCalled()
  })

  it('refuses a revoked connection even while its access token is unexpired', async () => {
    const response = await post(rpc('tools/list'), bearer(revokedToken))

    expect(response.status).toBe(401)
    expect(findPlatformLevel).not.toHaveBeenCalled()
  })

  it('refuses a holder who is no longer an admin of the school', async () => {
    findMembership.mockResolvedValue({ userId: 'user-1', schoolId: 'school-1', role: 'PARENT' })

    const response = await post(rpc('tools/list'), bearer(accessToken))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'forbidden' })
  })

  it('refuses a holder whose school was deactivated', async () => {
    findActiveById.mockResolvedValue(null)

    expect((await post(rpc('tools/list'), bearer(accessToken))).status).toBe(403)
  })

  it('records the connection usage off the response path', async () => {
    await post(rpc('tools/list'), bearer(accessToken))

    expect(grantTouch).not.toHaveBeenCalled()
    for (const [callback] of afterMock.mock.calls) await callback()
    expect(grantTouch).toHaveBeenCalledWith(
      'grant-1',
      'school-1',
      expect.any(Date),
      expect.any(Date)
    )
    expect(keyTouch).not.toHaveBeenCalled()
  })

  it('still serves a legacy API key on the same route', async () => {
    const response = await post(rpc('tools/list'), { 'x-api-key': apiKey })

    expect(response.status).toBe(200)
    expect(findByHash).toHaveBeenCalledWith(hashMcpKey(apiKey))
    expect(findTokenByHash).not.toHaveBeenCalled()
  })
})
