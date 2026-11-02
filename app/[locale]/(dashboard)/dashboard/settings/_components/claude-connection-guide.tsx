import { PlayCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { McpSite } from '../_lib/mcp-client-setup'
import { Field } from './mcp-client-guides'

type Props = {
  site: McpSite
  onCopy: (value: string) => void
}

const TUTORIAL = '/api/tutorials/claude-connection'

export function ClaudeConnectionGuide({ site, onCopy }: Props) {
  const t = useTranslations('settings.apiKeys.connections.claudeSetup')

  return (
    <details className="mt-4 rounded border border-alabaster-700 px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium text-graphite">
        <span className="inline-flex items-center gap-2">
          <PlayCircle className="size-4 text-primary" aria-hidden="true" />
          {t('title')}
        </span>
      </summary>
      <div className="mt-3 space-y-4">
        <p className="text-sm text-graphite-600">{t('description')}</p>
        <video
          controls
          playsInline
          preload="none"
          width={1920}
          height={1080}
          poster={`${TUTORIAL}/poster`}
          aria-label={t('videoLabel')}
          className="aspect-video w-full max-w-3xl rounded bg-graphite"
        >
          <source src={`${TUTORIAL}/video`} type="video/mp4" />
          <track
            src={`${TUTORIAL}/captions`}
            kind="captions"
            srcLang="fr"
            label={t('captionsLabel')}
          />
          <a href={`${TUTORIAL}/video`}>{t('download')}</a>
        </video>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-graphite">
          {(['step1', 'step2', 'step3'] as const).map((step) => (
            <li key={step}>{t(step)}</li>
          ))}
        </ol>
        <Field label={t('urlLabel')} value={site.url} copyLabel={t('copyUrl')} onCopy={onCopy} />
      </div>
    </details>
  )
}
