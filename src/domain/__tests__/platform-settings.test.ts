import { describe, expect, it } from 'vitest'
import {
  AI_ASSISTANT_ENABLED_SETTING,
  MCP_ENABLED_SETTING,
  OPENROUTER_API_KEY_SETTING,
  SCHOOL_SWITCH_SETTING,
} from '../platform-settings'

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

describe('AI_ASSISTANT_ENABLED_SETTING', () => {
  it('names the platform flag governing the enrollment assistant', () => {
    expect(AI_ASSISTANT_ENABLED_SETTING).toBe('ai_assistant_enabled')
  })
})

describe('OPENROUTER_API_KEY_SETTING', () => {
  it('names the encrypted setting holding the OpenRouter key', () => {
    expect(OPENROUTER_API_KEY_SETTING).toBe('openrouter_api_key')
  })
})
