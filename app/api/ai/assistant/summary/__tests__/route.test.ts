import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSchoolContextMock = vi.fn()
const isAiAssistantEnabledMock = vi.fn()
const readOpenRouterApiKeyMock = vi.fn()
const generateTextMock = vi.fn()
const createOpenRouterMock = vi.fn()

vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  generateText: generateTextMock,
}))
vi.mock('@openrouter/ai-sdk-provider', () => ({ createOpenRouter: createOpenRouterMock }))
vi.mock('@/lib/auth', () => ({ auth: {} }))
vi.mock('@/lib/school-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/school-context')>()),
  getSchoolContext: getSchoolContextMock,
}))
vi.mock('@/use-cases/platform-settings/is-ai-assistant-enabled', () => ({
  isAiAssistantEnabled: isAiAssistantEnabledMock,
}))
vi.mock('@/use-cases/platform-settings/openrouter-api-key', () => ({
  readOpenRouterApiKey: readOpenRouterApiKeyMock,
}))

const { POST } = await import('../route')

const admin = { userId: 'user-1', schoolId: 'school-1', isSuperAdmin: false, roles: ['ADMIN'] }

const conversation = {
  messages: [
    { role: 'user', parts: [{ type: 'text', text: 'Inscris Yusri en Chiyoni' }] },
    {
      role: 'assistant',
      parts: [
        {
          type: 'tool-commit_enroll_family',
          state: 'approval-requested',
          input: { draftId: 'd1' },
        },
      ],
    },
  ],
}

const request = (body: unknown = conversation, headers: Record<string, string> = {}) =>
  new Request('http://localhost:8550/api/ai/assistant/summary', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

let userSeq = 0

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('BETTER_AUTH_SECRET', 'test-auth-secret')
  userSeq += 1
  getSchoolContextMock.mockResolvedValue({ ...admin, userId: `summary-user-${userSeq}` })
  isAiAssistantEnabledMock.mockResolvedValue(true)
  readOpenRouterApiKeyMock.mockResolvedValue('test-openrouter-key')
  createOpenRouterMock.mockReturnValue(vi.fn(() => 'model'))
  generateTextMock.mockResolvedValue({
    text: '- Contexte : inscription de Yusri',
    finishReason: 'stop',
  })
})

describe('POST /api/ai/assistant/summary', () => {
  it('summarizes the transcript without offering any tool', async () => {
    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ summary: '- Contexte : inscription de Yusri' })
    const options = generateTextMock.mock.calls[0][0]
    expect(options.tools).toBeUndefined()
    expect(options.prompt).toContain('ADMIN: Inscris Yusri en Chiyoni')
    expect(options.prompt).toContain('TOOL commit_enroll_family [awaiting-validation-not-done]')
  })

  it('accepts a conversation the chat route would refuse as too long', async () => {
    const messages = Array.from({ length: 60 }, (_, index) => ({
      role: index % 2 ? 'assistant' : 'user',
      parts: [{ type: 'text', text: `message ${index}` }],
    }))

    const response = await POST(request({ messages }))

    expect(response.status).toBe(200)
  })

  it('caps the summary length', async () => {
    generateTextMock.mockResolvedValue({ text: 'a'.repeat(20_000), finishReason: 'length' })

    const { summary } = await (await POST(request())).json()

    expect(summary.length).toBe(6_000)
  })

  it.each([
    ['a cross-site request', () => request(conversation, { 'sec-fetch-site': 'cross-site' }), 403],
    ['a malformed body', () => request('{'), 400],
    ['an empty conversation', () => request({ messages: [] }), 400],
    ['an unknown role', () => request({ messages: [{ role: 'system', parts: [] }] }), 400],
  ])('refuses %s', async (_, build, status) => {
    const response = await POST(build())

    expect(response.status).toBe(status)
    expect(generateTextMock).not.toHaveBeenCalled()
  })

  it('refuses a visitor without session or a non-admin member', async () => {
    getSchoolContextMock.mockResolvedValueOnce(null)
    expect((await POST(request())).status).toBe(401)

    getSchoolContextMock.mockResolvedValueOnce({ ...admin, roles: ['PARENT'], familyId: 'f-1' })
    expect((await POST(request())).status).toBe(403)
    expect(generateTextMock).not.toHaveBeenCalled()
  })

  it('refuses when the assistant is off or not configured', async () => {
    isAiAssistantEnabledMock.mockResolvedValueOnce(false)
    expect(await (await POST(request())).json()).toEqual({ error: 'aiAssistantDisabled' })

    readOpenRouterApiKeyMock.mockResolvedValueOnce(null)
    expect(await (await POST(request())).json()).toEqual({ error: 'aiAssistantNotConfigured' })
  })

  it('reports an empty answer or a provider failure as a code', async () => {
    generateTextMock.mockResolvedValueOnce({ text: '  ', finishReason: 'stop' })
    expect(await (await POST(request())).json()).toEqual({ error: 'providerError' })

    generateTextMock.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'TimeoutError' }))
    const response = await POST(request())
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: 'timeout' })
  })

  it('rate-limits each admin', async () => {
    getSchoolContextMock.mockResolvedValue({ ...admin, userId: 'busy-user' })
    for (let index = 0; index < 20; index += 1) await POST(request())

    const response = await POST(request())

    expect(response.status).toBe(429)
  })
})
