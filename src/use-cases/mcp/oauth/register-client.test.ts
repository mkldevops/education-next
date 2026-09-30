import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerOAuthClient } from './register-client'

const REDIRECT_URI = 'https://chatgpt.com/connector_platform_oauth_redirect'

const create = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  create.mockImplementation(async (data: { clientName: string; redirectUris: string[] }) => ({
    id: '4d5c0a4a-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
    createdAt: new Date('2026-09-29T08:00:00Z'),
    ...data,
  }))
})

describe('registerOAuthClient', () => {
  it('registers a public client and echoes RFC 7591 metadata without a secret', async () => {
    const result = await registerOAuthClient(
      { client_name: '  ChatGPT ', redirect_uris: [REDIRECT_URI, REDIRECT_URI] },
      { create }
    )

    expect(result).toEqual({
      client_id: '4d5c0a4a-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
      client_id_issued_at: 1790668800,
      client_name: 'ChatGPT',
      redirect_uris: [REDIRECT_URI],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    })
    expect(JSON.stringify(result)).not.toContain('client_secret')
  })

  it('refuses metadata that is not a public PKCE client', async () => {
    for (const input of [
      null,
      {},
      { client_name: 'X', redirect_uris: ['http://chatgpt.com/cb'] },
      {
        client_name: 'X',
        redirect_uris: [REDIRECT_URI],
        token_endpoint_auth_method: 'client_secret_basic',
      },
      { client_name: '', redirect_uris: [REDIRECT_URI] },
    ]) {
      expect(await registerOAuthClient(input, { create })).toBe('invalidClientMetadata')
    }
    expect(create).not.toHaveBeenCalled()
  })
})
