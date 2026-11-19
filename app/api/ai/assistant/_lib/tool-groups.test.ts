import { describe, expect, it } from 'vitest'
import { listSchoolTools } from '@/mcp/school-tools'
import {
  activeToolsFor,
  CORE_TOOLS,
  loadedGroups,
  TOOL_GROUPS,
  type ToolGroup,
} from './tool-groups'

const catalog = listSchoolTools({
  schoolId: 'school-1',
  userId: 'user-1',
  paymentsEnabled: true,
  owner: { kind: 'ADMIN_SESSION', userId: 'user-1' },
}).map((tool) => tool.name)

const grouped = [...CORE_TOOLS, ...Object.values(TOOL_GROUPS).flatMap((group) => [...group.tools])]

describe('tool groups', () => {
  it('places every catalog tool in exactly one group', () => {
    expect([...grouped].sort()).toEqual([...catalog].sort())
    expect(new Set(grouped).size).toBe(grouped.length)
  })

  it('keeps each preview with its commit', () => {
    for (const group of Object.values(TOOL_GROUPS)) {
      const names = new Set<string>(group.tools)
      for (const name of names) {
        if (name.startsWith('preview_')) {
          expect(names.has(name.replace(/^preview_/, 'commit_'))).toBe(true)
        }
      }
    }
  })

  it('loads the group of a tool called while inactive', () => {
    const groups = loadedGroups([], [{ toolCalls: [{ toolName: 'subscribe_meal' }] }])
    expect([...groups]).toEqual(['meals'])
  })

  it('ignores a malformed load_tools call', () => {
    const groups = loadedGroups([], [{ toolCalls: [{ toolName: 'load_tools', input: {} }] }])
    expect(groups.size).toBe(0)
  })

  it('never activates a tool missing from the caller catalog', () => {
    const names = new Set(['find_students', 'load_tools'])
    expect(activeToolsFor(new Set<ToolGroup>(['payments']), names)).toEqual([
      'find_students',
      'load_tools',
    ])
  })
})
