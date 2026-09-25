import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSchoolContextMock = vi.fn()
const isAiAssistantEnabledMock = vi.fn()
const readOpenRouterApiKeyMock = vi.fn()
const isPaymentsEnabledMock = vi.fn()
const listClassPeriodsMock = vi.fn()
const listPlansMock = vi.fn()
const purgeExpiredDraftsMock = vi.fn()
const afterMock = vi.fn()
const sanitizeImageMock = vi.fn()
const streamTextMock = vi.fn()
const toUIMessageStreamResponseMock = vi.fn()
const convertToModelMessagesMock = vi.fn()
const createOpenRouterMock = vi.fn()
const modelFactoryMock = vi.fn()

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: afterMock,
}))
vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  streamText: streamTextMock,
  convertToModelMessages: convertToModelMessagesMock,
}))
vi.mock('@openrouter/ai-sdk-provider', () => ({ createOpenRouter: createOpenRouterMock }))
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
vi.mock('@/use-cases/config/is-payments-enabled', () => ({
  isPaymentsEnabled: isPaymentsEnabledMock,
}))
vi.mock('@/gateways/mcp-read-gateway', () => ({
  mcpReadGateway: { listClassPeriods: listClassPeriodsMock, listPlans: listPlansMock },
}))
vi.mock('@/use-cases/mcp/purge-expired-drafts', () => ({
  purgeExpiredDrafts: purgeExpiredDraftsMock,
}))
vi.mock('@/use-cases/ai-assistant/sanitize-image', () => ({ sanitizeImage: sanitizeImageMock }))

const { GET, POST } = await import('../route')

const admin = { userId: 'user-1', schoolId: 'school-1', isSuperAdmin: false, role: 'ADMIN' }
const superAdmin = { userId: 'user-2', schoolId: 'school-1', isSuperAdmin: true, role: null }
const parent = {
  userId: 'user-3',
  schoolId: 'school-1',
  isSuperAdmin: false,
  role: 'PARENT',
  familyId: 'family-1',
}
const teacher = { userId: 'user-4', schoolId: 'school-1', isSuperAdmin: false, role: 'TEACHER' }

const textTurn = { role: 'user', parts: [{ type: 'text', text: 'Famille Durand, CE1' }] }

const request = (body: unknown = { messages: [textTurn] }, headers: Record<string, string> = {}) =>
  new Request('http://localhost:8550/api/ai/enroll-assistant', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'sec-fetch-site': 'same-origin',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

/** Le limiteur est module-level et glisse sur 60 s : un utilisateur frais par test. */
let userSeq = 0

beforeEach(() => {
  vi.clearAllMocks()
  userSeq += 1
  getSchoolContextMock.mockResolvedValue({ ...admin, userId: `user-${userSeq}` })
  isAiAssistantEnabledMock.mockResolvedValue(true)
  readOpenRouterApiKeyMock.mockResolvedValue('test-openrouter-key')
  isPaymentsEnabledMock.mockResolvedValue(true)
  listClassPeriodsMock.mockResolvedValue([{ name: 'CE1' }, { name: 'CE2' }])
  listPlansMock.mockResolvedValue([{ name: 'Annuel' }])
  convertToModelMessagesMock.mockResolvedValue([{ role: 'user', content: 'converted' }])
  toUIMessageStreamResponseMock.mockReturnValue(new Response('stream', { status: 200 }))
  streamTextMock.mockReturnValue({ toUIMessageStreamResponse: toUIMessageStreamResponseMock })
  modelFactoryMock.mockReturnValue({ modelId: 'mocked-model' })
  createOpenRouterMock.mockReturnValue(modelFactoryMock)
  sanitizeImageMock.mockResolvedValue({
    status: 'OK',
    dataUrl: 'data:image/webp;base64,c2FuaXRpemVk',
    width: 10,
    height: 10,
  })
})

describe('POST /api/ai/enroll-assistant', () => {
  it('refuses a cross-site request before reading the session', async () => {
    const response = await POST(request(undefined, { 'sec-fetch-site': 'cross-site' }))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'forbidden' })
    expect(getSchoolContextMock).not.toHaveBeenCalled()
  })

  it('refuses a request that is not JSON, as a form post would be', async () => {
    const response = await POST(
      new Request('http://localhost:8550/api/ai/enroll-assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'messages=x',
      })
    )

    expect(response.status).toBe(403)
    expect(getSchoolContextMock).not.toHaveBeenCalled()
  })

  it('compares the origin with the served host when the browser omits sec-fetch-site', async () => {
    const refused = await POST(
      request(undefined, {
        'sec-fetch-site': '',
        origin: 'https://evil.example',
        host: 'school.example',
      })
    )
    expect(refused.status).toBe(403)

    const accepted = await POST(
      request(undefined, {
        'sec-fetch-site': '',
        origin: 'https://school.example',
        'x-forwarded-host': 'school.example',
      })
    )
    expect(accepted.status).toBe(200)
  })

  it('answers 401 without a session', async () => {
    getSchoolContextMock.mockResolvedValue(null)

    const response = await POST(request())

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'unauthorized' })
    expect(isAiAssistantEnabledMock).not.toHaveBeenCalled()
  })

  it('answers 403 for a parent or a teacher of the active school', async () => {
    for (const context of [parent, teacher]) {
      getSchoolContextMock.mockResolvedValue(context)

      const response = await POST(request())

      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({ error: 'forbidden' })
    }
    expect(isAiAssistantEnabledMock).not.toHaveBeenCalled()
    expect(streamTextMock).not.toHaveBeenCalled()
  })

  it('serves a super admin on the active school', async () => {
    getSchoolContextMock.mockResolvedValue(superAdmin)

    const response = await POST(request())

    expect(response.status).toBe(200)
  })

  it('schedules the draft sweep before checking the flag', async () => {
    isAiAssistantEnabledMock.mockResolvedValue(false)

    await POST(request())

    expect(afterMock).toHaveBeenCalledTimes(1)
    afterMock.mock.calls[0][0]()
    expect(purgeExpiredDraftsMock).toHaveBeenCalledTimes(1)
  })

  it('refuses while the platform flag is off, without decrypting the key', async () => {
    isAiAssistantEnabledMock.mockResolvedValue(false)

    const response = await POST(request())

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'aiAssistantDisabled' })
    expect(readOpenRouterApiKeyMock).not.toHaveBeenCalled()
    expect(streamTextMock).not.toHaveBeenCalled()
  })

  it('refuses when no key is configured or the key is unreadable', async () => {
    readOpenRouterApiKeyMock.mockResolvedValue(null)

    const response = await POST(request())

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'aiAssistantNotConfigured' })
    expect(streamTextMock).not.toHaveBeenCalled()
  })

  it('throttles one administrator on one school', async () => {
    let last: Response | undefined
    for (let i = 0; i < 21; i += 1) last = await POST(request())

    expect(last?.status).toBe(429)
    expect(await last?.json()).toEqual({ error: 'tooManyRequests' })
    expect(streamTextMock).toHaveBeenCalledTimes(20)
  })

  it('rejects a malformed body without calling the provider', async () => {
    const cases: [unknown, number, string][] = [
      ['{not json', 400, 'invalidRequest'],
      [{ messages: [] }, 400, 'invalidRequest'],
      [
        {
          messages: [{ role: 'user', parts: [{ type: 'file', mediaType: 'image/gif', url: 'x' }] }],
        },
        415,
        'forbiddenFile',
      ],
    ]

    for (const [body, status, error] of cases) {
      const response = await POST(request(body))
      expect(response.status).toBe(status)
      expect(await response.json()).toEqual({ error })
    }
    expect(streamTextMock).not.toHaveBeenCalled()
  })

  it('reports an unreadable image as 422 without a business record', async () => {
    sanitizeImageMock.mockResolvedValue({ status: 'unreadableImage' })

    const response = await POST(
      request({
        messages: [
          {
            role: 'user',
            parts: [{ type: 'file', mediaType: 'image/png', url: 'data:image/png;base64,AAAA' }],
          },
        ],
      })
    )

    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({ error: 'unreadableImage' })
    expect(streamTextMock).not.toHaveBeenCalled()
  })

  it('hands the sanitized conversation, the school vocabulary and one tool to the model', async () => {
    const response = await POST(
      request({
        messages: [
          {
            role: 'user',
            parts: [
              { type: 'text', text: 'Voici la fiche' },
              { type: 'file', mediaType: 'image/jpeg', url: 'data:image/jpeg;base64,/9j/AAAA' },
            ],
          },
        ],
      })
    )

    expect(response.status).toBe(200)
    expect(createOpenRouterMock).toHaveBeenCalledWith({ apiKey: 'test-openrouter-key' })
    expect(modelFactoryMock).toHaveBeenCalledWith('google/gemini-2.5-flash')

    const [uiMessages, conversionOptions] = convertToModelMessagesMock.mock.calls[0]
    expect(uiMessages[0].parts[1]).toMatchObject({
      type: 'file',
      mediaType: 'image/webp',
      url: 'data:image/webp;base64,c2FuaXRpemVk',
    })
    expect(conversionOptions.ignoreIncompleteToolCalls).toBe(true)

    const options = streamTextMock.mock.calls[0][0]
    expect(Object.keys(options.tools)).toEqual(['propose_enrollment'])
    expect(options.messages).toEqual([{ role: 'user', content: 'converted' }])
    expect(options.system).toContain('CE1 | CE2')
    expect(options.system).toContain('Annuel')
    expect(options.system).toContain('Never invent a value')
    expect(options.maxOutputTokens).toBe(4000)
    expect(options.abortSignal).toBeInstanceOf(AbortSignal)
  })

  it('never offers a commit tool and only acknowledges the proposal', async () => {
    await POST(request())

    const { tools } = streamTextMock.mock.calls[0][0]
    expect(tools.commit_enroll_family).toBeUndefined()
    expect(tools.preview_enroll_family).toBeUndefined()
    await expect(tools.propose_enrollment.execute({}, {})).resolves.toEqual({ status: 'proposed' })
  })

  it('hides plan names from the model while payments are disabled', async () => {
    isPaymentsEnabledMock.mockResolvedValue(false)

    await POST(request())

    const options = streamTextMock.mock.calls[0][0]
    expect(options.system).not.toContain('Annuel')
    expect(options.system).toContain('Payments are disabled')
  })

  it('uses the allowlisted model from the environment and falls back otherwise', async () => {
    vi.stubEnv('AI_ASSISTANT_MODEL', 'anthropic/claude-haiku-4.5')
    await POST(request())
    expect(modelFactoryMock).toHaveBeenLastCalledWith('anthropic/claude-haiku-4.5')

    vi.stubEnv('AI_ASSISTANT_MODEL', 'some/unknown-model')
    getSchoolContextMock.mockResolvedValue({ ...admin, userId: `user-${userSeq}-b` })
    await POST(request())
    expect(modelFactoryMock).toHaveBeenLastCalledWith('google/gemini-2.5-flash')
    vi.unstubAllEnvs()
  })

  it('maps provider failures to codes instead of leaking messages', async () => {
    await POST(request())

    const { onError } = toUIMessageStreamResponseMock.mock.calls[0][0]
    const { APICallError } = await import('ai')
    const apiError = (statusCode: number) =>
      new APICallError({
        message: 'secret detail https://openrouter.ai/api/v1',
        url: 'https://openrouter.ai/api/v1',
        requestBodyValues: {},
        statusCode,
      })

    expect(onError(apiError(401))).toBe('invalidKey')
    expect(onError(apiError(402))).toBe('quotaExceeded')
    expect(onError(apiError(429))).toBe('providerRateLimited')
    expect(onError(apiError(500))).toBe('providerError')
    expect(onError(new DOMException('aborted', 'TimeoutError'))).toBe('timeout')
    expect(onError(new Error('boom'))).toBe('providerError')
  })

  it('answers 500 with a neutral code on an unexpected failure', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    listClassPeriodsMock.mockRejectedValue(new Error('db down'))

    const response = await POST(request())

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'serverError' })
    consoleError.mockRestore()
  })
})

describe('GET /api/ai/enroll-assistant', () => {
  it('is not served', async () => {
    const response = GET()

    expect(response.status).toBe(405)
  })
})
