import { describe, expect, it } from 'vitest'
import { MCP_ENABLED_SETTING, SCHOOL_SWITCH_SETTING } from '../platform-settings'

describe('SCHOOL_SWITCH_SETTING', () => {
  it('names the platform flag governing the school switch', () => {
    expect(SCHOOL_SWITCH_SETTING).toBe('school_switch_enabled')
  })
})

describe('MCP_ENABLED_SETTING', () => {
  it('names the platform flag governing the MCP server', () => {
    expect(MCP_ENABLED_SETTING).toBe('mcp_enabled')
  })
})
