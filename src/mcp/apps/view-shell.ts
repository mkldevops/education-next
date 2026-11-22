/** Version du protocole MCP Apps (spécification stable 2026-01-26). */
const MCP_APP_PROTOCOL_VERSION = '2026-01-26'

const BASE_STYLE = `
:root{color-scheme:light;
--fg:var(--color-text-primary,#1c2321);--muted:var(--color-text-secondary,#6b7370);
--bg:var(--color-background-primary,#ffffff);--hover:var(--color-background-secondary,#f3f5f4);
--line:var(--color-border-primary,#e3e7e5);--danger:var(--color-text-danger,#b4232a);
--danger-soft:var(--color-background-danger,#fbe9ea);--radius:var(--border-radius-lg,14px);
--font:var(--font-sans,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif)}
:root[data-theme=dark]{color-scheme:dark;--fg:var(--color-text-primary,#eef1f0);--muted:var(--color-text-secondary,#9aa3a0);
--bg:var(--color-background-primary,#17191a);--hover:var(--color-background-secondary,#222628);
--line:var(--color-border-primary,#2e3335);--danger:var(--color-text-danger,#f07178);
--danger-soft:var(--color-background-danger,#3a1d20)}
*{box-sizing:border-box}
html,body{margin:0;background:transparent;color:var(--fg);font:14px/1.45 var(--font)}
.card{background:var(--bg);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden}
.empty{margin:0;padding:12px 14px;border:1px dashed var(--line);border-radius:var(--radius);color:var(--muted)}
`

/**
 * Pont minimal d'une vue MCP Apps, sans dépendance : poignée de main `ui/initialize`,
 * réception du résultat d'outil, liens et taille. La vue ne reçoit des données que par
 * `ui/notifications/tool-result` et les écrit avec `textContent`, jamais en HTML.
 */
const BRIDGE = `
let nextId = 1
const pending = new Map()
let context = {}
let lastResult = null
const send = (message) => window.parent.postMessage(Object.assign({ jsonrpc: '2.0' }, message), '*')
const notify = (method, params) => send({ method, params })
const request = (method, params) => new Promise((resolve, reject) => {
  const id = nextId++
  pending.set(id, { resolve, reject })
  send({ id, method, params })
})
function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}
function readResult(result) {
  if (!result) return null
  if (result.structuredContent && typeof result.structuredContent === 'object') return result.structuredContent
  const text = (result.content || []).find((block) => block && block.type === 'text')
  if (!text) return null
  try { return JSON.parse(text.text) } catch { return null }
}
function openLink(path) {
  request('ui/open-link', { url: new URL(path, ORIGIN).href }).catch(() => {})
}
function applyContext() {
  const root = document.documentElement
  if (context.theme) root.dataset.theme = context.theme
  const variables = context.styles && context.styles.variables
  if (variables) for (const [key, value] of Object.entries(variables)) if (value) root.style.setProperty(key, value)
}
function draw() {
  if (lastResult) render(lastResult, context)
}
window.addEventListener('message', (event) => {
  if (event.source !== window.parent) return
  const message = event.data
  if (!message || message.jsonrpc !== '2.0') return
  if (message.id !== undefined && message.method === undefined) {
    const waiting = pending.get(message.id)
    if (!waiting) return
    pending.delete(message.id)
    if (message.error) waiting.reject(message.error)
    else waiting.resolve(message.result)
    return
  }
  if (message.method === 'ui/notifications/tool-result') {
    lastResult = message.params
    draw()
  } else if (message.method === 'ui/notifications/host-context-changed') {
    context = Object.assign({}, context, message.params)
    applyContext()
    draw()
  }
  if (message.id !== undefined && message.method !== undefined) {
    if (message.method === 'ping' || message.method === 'ui/resource-teardown') send({ id: message.id, result: {} })
    else send({ id: message.id, error: { code: -32601, message: 'Method not found' } })
  }
})
let lastHeight = 0
new ResizeObserver(() => {
  const height = Math.ceil(document.documentElement.getBoundingClientRect().height)
  if (height === lastHeight) return
  lastHeight = height
  notify('ui/notifications/size-changed', { height })
}).observe(document.documentElement)
request('ui/initialize', {
  appInfo: { name: 'education', version: '1.0.0' },
  appCapabilities: {},
  protocolVersion: PROTOCOL_VERSION,
}).then((result) => {
  context = (result && result.hostContext) || {}
  applyContext()
  notify('ui/notifications/initialized', {})
  draw()
}).catch(() => {})
`

const inlineJson = (value: unknown) => JSON.stringify(value).replaceAll('<', '\\u003c')

/**
 * Document autonome d'une vue : aucune ressource externe, aucune donnée d'école. Le
 * script de la vue définit `render(result, context)`.
 */
export function mcpAppDocument({
  title,
  origin,
  style,
  script,
}: {
  title: string
  origin: string
  style: string
  script: string
}): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>${BASE_STYLE}${style}</style>
</head>
<body>
<main id="app"></main>
<script>
const ORIGIN = ${inlineJson(origin)}
const PROTOCOL_VERSION = ${inlineJson(MCP_APP_PROTOCOL_VERSION)}
${script}
${BRIDGE}
</script>
</body>
</html>`
}
