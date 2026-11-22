import { createMcpHandler } from '@modelcontextprotocol/server'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { OVERDUE_VIEW_URI } from './apps/overdue-view'

vi.mock('@/lib/app-url', () => ({ appOrigin: () => 'https://school.test' }))
vi.mock('./school-tools', () => ({
  listSchoolTools: () => [
    {
      name: 'list_overdue_students',
      title: 'Impayés',
      description: 'Élèves en retard',
      inputSchema: z.object({}),
      ui: OVERDUE_VIEW_URI,
      run: async () => ({ students: [], total: 0, totalOverdueAmount: 0, currency: 'EUR' }),
    },
  ],
}))

const { buildMcpServer } = await import('./server')

const HEADERS = {
  'content-type': 'application/json',
  accept: 'application/json, text/event-stream',
  'mcp-protocol-version': '2025-06-18',
}

const handler = createMcpHandler(() => buildMcpServer({} as never), { responseMode: 'json' })

async function rpc(method: string, params: Record<string, unknown> = {}) {
  const response = await handler.fetch(
    new Request('https://school.test/api/mcp', {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    })
  )
  const text = await response.text()
  const data = text.startsWith('{')
    ? text
    : text.split('\n').find((line) => line.startsWith('data:'))
  return JSON.parse(data?.replace(/^data:/, '') ?? 'null')
}

const INIT = {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'test', version: '1' },
}

describe('MCP Apps over the real server', () => {
  it('advertises resources and lists the view on the tool', async () => {
    const init = await rpc('initialize', INIT)
    const list = await rpc('tools/list')

    expect(init.result.capabilities.resources).toBeDefined()
    const tool = list.result.tools.find((t: { name: string }) => t.name === 'list_overdue_students')
    expect(tool._meta).toMatchObject({
      ui: { resourceUri: OVERDUE_VIEW_URI },
      'ui/resourceUri': OVERDUE_VIEW_URI,
    })
  })

  it('serves the view through resources/read', async () => {
    const read = await rpc('resources/read', { uri: OVERDUE_VIEW_URI })

    const [content] = read.result.contents
    expect(content.mimeType).toBe('text/html;profile=mcp-app')
    expect(content.text).toContain('ui/initialize')
    expect(content.text).toContain('https://school.test')
  })
})
