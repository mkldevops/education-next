'use client'

import {
  AppBridge,
  type McpUiStyles,
  PostMessageTransport,
} from '@modelcontextprotocol/ext-apps/app-bridge'
import { useLocale } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from '@/i18n/routing'
import { INTERNAL_HREF } from './internal-href'

const HOST_INFO = { name: 'education-assistant', version: '1.0.0' }

const THEME_VARIABLES: Record<string, string> = {
  '--color-text-primary': '--foreground',
  '--color-text-secondary': '--muted-foreground',
  '--color-background-primary': '--surface',
  '--color-background-secondary': '--surface-2',
  '--color-border-primary': '--border',
  '--color-text-danger': '--danger',
  '--color-background-danger': '--danger-subtle',
  '--font-sans': '--font-sans',
}

/** Variables de thème de l'application, sous les noms standard des hôtes MCP Apps ; le reste garde le repli de la vue. */
function themeVariables(): McpUiStyles {
  const computed = getComputedStyle(document.documentElement)
  const variables: Record<string, string> = {}
  for (const [hostName, appName] of Object.entries(THEME_VARIABLES)) {
    const value = computed.getPropertyValue(appName).trim()
    if (value) variables[hostName] = value
  }
  return variables as McpUiStyles
}

/** Chemin interne d'une URL demandée par la vue, ou `null` si elle sort de l'application. */
export function internalPath(url: string, origin: string): string | null {
  let target: URL
  try {
    target = new URL(url)
  } catch {
    return null
  }
  if (target.origin !== origin) return null
  const path = target.pathname + target.search
  return INTERNAL_HREF.test(path) ? path : null
}

type Props = { html: (origin: string) => string; output: unknown; title: string }

/**
 * Hôte MCP Apps de l'assistant : la vue tourne dans une iframe isolée (`allow-scripts`
 * seul, origine opaque) et ne reçoit que le résultat déjà affiché à l'utilisateur. Elle
 * ne peut ni appeler d'outil ni naviguer hors du tableau de bord.
 */
export function McpAppFrame({ html, output, title }: Props) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(0)
  const locale = useLocale()
  const router = useRouter()
  const outputRef = useRef(output)
  outputRef.current = output

  useEffect(() => {
    const iframe = frame.current
    const target = iframe?.contentWindow
    if (!iframe || !target) return
    const origin = window.location.origin
    const bridge = new AppBridge(
      null,
      HOST_INFO,
      { openLinks: {} },
      {
        hostContext: {
          theme: 'light',
          locale,
          displayMode: 'inline',
          styles: { variables: themeVariables() },
        },
      }
    )
    bridge.onsizechange = ({ height: next }) => {
      if (typeof next === 'number') setHeight(Math.ceil(next))
    }
    bridge.onopenlink = async ({ url }) => {
      const path = internalPath(url, origin)
      if (!path) return { isError: true }
      router.push(path)
      return {}
    }
    bridge.oninitialized = () => {
      const result = outputRef.current
      void bridge.sendToolResult({
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: result as Record<string, unknown>,
      })
    }
    let closed = false
    void bridge.connect(new PostMessageTransport(target, target)).then(() => {
      if (!closed) iframe.srcdoc = html(origin)
    })
    return () => {
      closed = true
      void bridge.close()
    }
  }, [html, locale, router])

  return (
    <iframe
      ref={frame}
      title={title}
      sandbox="allow-scripts"
      className="mt-2 block w-full rounded-xl border-0"
      style={{ height: height || 120 }}
    />
  )
}
