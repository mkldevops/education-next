// @vitest-environment node
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const script = readFileSync('public/sw.js', 'utf8')
const handlers = new Map<string, (event: Record<string, unknown>) => void>()
const cache = { addAll: vi.fn(), match: vi.fn(), put: vi.fn() }
const caches = { open: vi.fn(), keys: vi.fn(), delete: vi.fn(), match: vi.fn() }
const fetcher = vi.fn()
const worker = {
  addEventListener: (type: string, callback: (event: Record<string, unknown>) => void) =>
    handlers.set(type, callback),
  skipWaiting: vi.fn(),
  clients: { claim: vi.fn() },
  location: { origin: 'https://school.test' },
}

function dispatch(type: string, input: Record<string, unknown> = {}) {
  let pending: Promise<unknown> | undefined
  const respondWith = vi.fn((value) => {
    pending = Promise.resolve(value)
  })
  handlers.get(type)?.({
    ...input,
    respondWith,
    waitUntil: (value: Promise<unknown>) => {
      pending = value
    },
  })
  return { done: () => pending, respondWith }
}

function request(path: string, options = {}) {
  return dispatch('fetch', {
    request: { url: `https://school.test${path}`, method: 'GET', mode: 'navigate', ...options },
  })
}

describe('production service worker', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    handlers.clear()
    cache.addAll.mockResolvedValue(undefined)
    caches.match.mockResolvedValue(undefined)
    caches.open.mockResolvedValue(cache)
    caches.keys.mockResolvedValue([])
    vm.runInNewContext(script, { self: worker, caches, fetch: fetcher, URL, Response })
  })

  it('precaches only public offline resources, without activating an update immediately', async () => {
    await dispatch('install').done()
    expect(cache.addAll).toHaveBeenCalledWith([
      '/offline.html',
      '/icon-192x192.png',
      '/icon-512x512.png',
    ])
    expect(worker.skipWaiting).not.toHaveBeenCalled()
  })

  it('serves the offline screen after a navigation network failure', async () => {
    fetcher.mockRejectedValue(new TypeError('Network error'))
    caches.match.mockResolvedValue(new Response('Offline screen'))
    const response = (await request('/en/dashboard').done()) as Response
    expect(await response.text()).toBe('Offline screen')
    expect(caches.match).toHaveBeenCalledWith('/offline.html')
    expect(cache.put).not.toHaveBeenCalled()
  })

  it('always fetches navigations from the network without caching private pages', async () => {
    fetcher.mockResolvedValue(new Response('School dashboard'))
    const response = (await request('/').done()) as Response
    expect(await response.text()).toBe('School dashboard')
    expect(cache.put).not.toHaveBeenCalled()
    expect(caches.match).not.toHaveBeenCalled()
  })

  it('keeps server failures distinguishable from a network outage', async () => {
    fetcher.mockResolvedValue(new Response('Server failure', { status: 500 }))
    expect(((await request('/dashboard').done()) as Response).status).toBe(500)
    expect(caches.match).not.toHaveBeenCalled()
  })

  it.each([
    ['/api/private', { mode: 'cors' }],
    ['/fr/dashboard?_rsc=1', { mode: 'cors' }],
    ['/fr/dashboard', { method: 'POST' }],
    ['/manifest.webmanifest', { mode: 'cors' }],
  ])('leaves %s requests untouched', (path, options) => {
    expect(request(path, options).respondWith).not.toHaveBeenCalled()
    expect(cache.put).not.toHaveBeenCalled()
  })

  it('deletes only obsolete app caches during activation', async () => {
    caches.keys.mockResolvedValue(['education-app-v2', 'another-app', 'education-app-v4'])
    await dispatch('activate').done()
    expect(caches.delete.mock.calls).toEqual([['education-app-v2']])
    expect(worker.clients.claim).toHaveBeenCalled()
  })

  it('activates an update only when explicitly requested', () => {
    dispatch('message', { data: { type: 'OTHER' } })
    expect(worker.skipWaiting).not.toHaveBeenCalled()
    dispatch('message', { data: { type: 'SKIP_WAITING' } })
    expect(worker.skipWaiting).toHaveBeenCalledTimes(1)
  })
})
