import { overdueViewHtml } from '@/mcp/apps/overdue-view'

/** Outils dont le résultat s'affiche dans leur vue MCP Apps, côté assistant intégré. */
const VIEWS: Record<string, (origin: string) => string> = {
  list_overdue_students: overdueViewHtml,
}

export function mcpAppViewFor(tool: string): ((origin: string) => string) | undefined {
  return Object.hasOwn(VIEWS, tool) ? VIEWS[tool] : undefined
}
