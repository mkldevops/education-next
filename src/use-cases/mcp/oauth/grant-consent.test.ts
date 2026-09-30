import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hashMcpKey } from '@/lib/mcp-key-crypto'
import { grantOAuthConsent } from './grant-consent'

const ORIGIN = 'https://ecole-a.example'
const CLIENT_ID = '4d5c0a4a-1a2b-4c3d-8e9f-0a1b2c3d4e5f'
const SCHOOL_ID = '7b1f3f8e-2c6d-4a1e-9f0b-5d4c3b2a1e0f'
const REDIRECT_URI = 'https://chatgpt.com/connector_platform_oauth_redirect'

const client = {
  id: CLIENT_ID,
  clientName: 'ChatGPT',
  redirectUris: [REDIRECT_URI],
  createdAt: new Date('2026-09-29T08:00:00Z'),
}

const query = {
  response_type: 'code',
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  code_challenge: 'c'.repeat(43),
  code_challenge_method: 'S256',
  state: 'xyz',
  resource: `${ORIGIN}/api/mcp`,
}

const findById = vi.fn()
const createWithCode = vi.fn()
const findActiveById = vi.fn()
const findMembership = vi.fn()

const deps = {
  clientGw: { findById },
  grantGw: { createWithCode },
  schoolGw: { findActiveById },
  memberGw: { findMembership },
}

const consent = (overrides: Partial<Parameters<typeof grantOAuthConsent>[0]> = {}) =>
  grantOAuthConsent(
    {
      user: { id: 'user-1', isSuperAdmin: false },
      schoolId: SCHOOL_ID,
      query,
      origin: ORIGIN,
      ...overrides,
    },
    deps
  )

beforeEach(() => {
  vi.clearAllMocks()
  findById.mockResolvedValue(client)
  createWithCode.mockResolvedValue({ id: 'grant-1' })
  findActiveById.mockResolvedValue({ id: SCHOOL_ID, name: 'École A', slug: 'ecole-a' })
  findMembership.mockResolvedValue({ userId: 'user-1', schoolId: SCHOOL_ID, role: 'ADMIN' })
})

describe('grantOAuthConsent', () => {
  it('creates the grant on the chosen school and redirects with a one-time code', async () => {
    const result = await consent()

    expect(result.status).toBe('OK')
    if (result.status !== 'OK') return

    const url = new URL(result.redirectTo)
    expect(`${url.origin}${url.pathname}`).toBe(REDIRECT_URI)
    expect(url.searchParams.get('state')).toBe('xyz')
    expect(url.searchParams.get('iss')).toBe(ORIGIN)
    const code = url.searchParams.get('code') ?? ''
    expect(code).toMatch(/^edu_oac_[A-Za-z0-9_-]{43}$/)

    const [grant, issued] = createWithCode.mock.calls[0]
    expect(grant).toEqual({
      schoolId: SCHOOL_ID,
      userId: 'user-1',
      clientId: CLIENT_ID,
      clientName: 'ChatGPT',
      resource: `${ORIGIN}/api/mcp`,
    })
    expect(issued).toMatchObject({
      tokenHash: hashMcpKey(code),
      prefix: code.slice(0, 12),
      codeChallenge: 'c'.repeat(43),
      redirectUri: REDIRECT_URI,
    })
    expect(JSON.stringify(issued)).not.toContain(code)
  })

  it('pins the audience to this site even when the client omitted resource', async () => {
    const result = await consent({ query: { ...query, resource: undefined } })

    expect(result.status).toBe('OK')
    expect(createWithCode.mock.calls[0][0].resource).toBe(`${ORIGIN}/api/mcp`)
  })

  it.each([
    ['a parent', { userId: 'user-1', schoolId: SCHOOL_ID, role: 'PARENT' }],
    ['a teacher', { userId: 'user-1', schoolId: SCHOOL_ID, role: 'TEACHER' }],
    ['a stranger to the school', null],
  ])('forbids %s, whatever the form says', async (_label, membership) => {
    findMembership.mockResolvedValue(membership)

    expect(await consent()).toEqual({ status: 'forbidden' })
    expect(createWithCode).not.toHaveBeenCalled()
  })

  it('forbids a deactivated school', async () => {
    findActiveById.mockResolvedValue(null)

    expect(await consent()).toEqual({ status: 'forbidden' })
    expect(createWithCode).not.toHaveBeenCalled()
  })

  it('lets a super admin grant any active school', async () => {
    findMembership.mockResolvedValue(null)

    const result = await consent({ user: { id: 'user-1', isSuperAdmin: true } })

    expect(result.status).toBe('OK')
    expect(findMembership).not.toHaveBeenCalled()
  })

  it('rejects a tampered school id or request before any lookup', async () => {
    expect(await consent({ schoolId: 'not-a-uuid' })).toEqual({ status: 'invalidRequest' })
    expect(await consent({ query: { ...query, code_challenge_method: 'plain' } })).toEqual({
      status: 'invalidRequest',
    })
    expect(
      await consent({ query: { ...query, resource: 'https://ecole-b.example/api/mcp' } })
    ).toEqual({ status: 'invalidRequest' })
    expect(createWithCode).not.toHaveBeenCalled()
  })
})
