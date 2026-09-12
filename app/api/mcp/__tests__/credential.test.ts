import { describe, expect, it } from 'vitest'
import { readMcpCredential } from '../_lib/credential'

const read = (init: Record<string, string>) => readMcpCredential(new Headers(init))

describe('readMcpCredential', () => {
  it('reads a bearer token, whatever the scheme casing', () => {
    expect(read({ authorization: 'Bearer edu_mcp_x' })).toBe('edu_mcp_x')
    expect(read({ authorization: 'bearer edu_mcp_x' })).toBe('edu_mcp_x')
    expect(read({ authorization: '  Bearer   edu_mcp_x  ' })).toBe('edu_mcp_x')
  })

  it('falls back to the named header when no Authorization is sent', () => {
    expect(read({ 'x-api-key': ' edu_mcp_x ' })).toBe('edu_mcp_x')
  })

  it('does not fall back when Authorization is present but unusable', () => {
    expect(read({ authorization: 'Basic abc', 'x-api-key': 'edu_mcp_x' })).toBeNull()
    expect(read({ authorization: 'Bearer a b', 'x-api-key': 'edu_mcp_x' })).toBeNull()
  })

  it('returns null when nothing is presented', () => {
    expect(read({})).toBeNull()
    expect(read({ 'x-api-key': '   ' })).toBeNull()
  })
})
