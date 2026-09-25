import { Button, Tabs } from '@peaklab/ui'
import { Copy } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  claudeCodeCommand,
  codexConfig,
  codexTokenExport,
  MCP_CLIENT_STATUS,
  MCP_CLIENTS,
  type McpClient,
  type McpClientStatus,
  type McpSite,
} from '../_lib/mcp-client-setup'

type Props = {
  site: McpSite
  apiKey: string
  onCopy: (value: string) => void
}

const WEB_STEPS: Record<'claudeWeb' | 'chatgpt', readonly string[]> = {
  claudeWeb: ['step1', 'step2', 'step3', 'step4'],
  chatgpt: ['step1', 'step2', 'step3'],
}

/**
 * Seuls les clients locaux reçoivent la clé dans leur exemple : Claude Web et ChatGPT se
 * connectent depuis le nuage de leur éditeur, donc leur parcours ne montre que l'URL du site.
 */
export function McpClientGuides({ site, apiKey, onCopy }: Props) {
  const t = useTranslations('settings.apiKeys.created')

  const content = (client: McpClient) => {
    switch (client) {
      case 'claudeCode':
        return (
          <Field
            label={t('clients.claudeCode.commandLabel')}
            value={claudeCodeCommand(site, apiKey)}
            copyLabel={t('clients.claudeCode.copyCommand')}
            onCopy={onCopy}
          />
        )
      case 'codex':
        return (
          <>
            <Field
              label={t('clients.codex.configLabel')}
              value={codexConfig(site)}
              copyLabel={t('clients.codex.copyConfig')}
              onCopy={onCopy}
            />
            <Field
              label={t('clients.codex.tokenLabel', { variable: site.tokenEnvVar })}
              value={codexTokenExport(site, apiKey)}
              copyLabel={t('clients.codex.copyToken')}
              onCopy={onCopy}
            />
            <p className="text-xs text-graphite-600">{t('clients.codex.webNote')}</p>
          </>
        )
      case 'claudeWeb':
      case 'chatgpt':
        return (
          <>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-graphite">
              {WEB_STEPS[client].map((step) => (
                <li key={step}>{t(`clients.${client}.${step}`, { name: site.serverName })}</li>
              ))}
            </ol>
            <Field
              label={t('urlLabel')}
              value={site.url}
              copyLabel={t('copyUrl')}
              onCopy={onCopy}
            />
            <p className="text-xs text-orange-600">{t(`clients.${client}.note`)}</p>
          </>
        )
    }
  }

  return (
    <div>
      <p className="text-xs font-medium text-graphite-600">{t('clientsLabel')}</p>
      <p className="mt-1 text-xs text-graphite-600">{t('siteLabel', { host: site.host })}</p>
      <div className="mt-2">
        <Tabs
          ariaLabel={t('clientsLabel')}
          tabs={MCP_CLIENTS.map((client) => ({
            label: t(`clients.${client}.label`),
            content: (
              <div className="space-y-3">
                <StatusBadge status={MCP_CLIENT_STATUS[client]} />
                {content(client)}
              </div>
            ),
          }))}
        />
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: McpClientStatus }) {
  const t = useTranslations('settings.apiKeys.created')

  return (
    <p
      className={
        status === 'ready'
          ? 'inline-block rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800'
          : 'inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800'
      }
    >
      {t(`status.${status}`)}
    </p>
  )
}

type FieldProps = {
  label: string
  value: string
  copyLabel: string
  onCopy: (value: string) => void
}

export function Field({ label, value, copyLabel, onCopy }: FieldProps) {
  return (
    <div>
      <p className="text-xs font-medium text-graphite-600">{label}</p>
      <div className="mt-1 flex items-start gap-2">
        <code className="min-w-0 flex-1 whitespace-pre-wrap break-all rounded bg-alabaster-900 px-3 py-2 font-mono text-xs text-graphite">
          {value}
        </code>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={copyLabel}
          onClick={() => onCopy(value)}
        >
          <Copy className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
