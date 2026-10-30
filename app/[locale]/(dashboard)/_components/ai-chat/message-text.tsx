import { Fragment, type ReactNode } from 'react'
import { Link } from '@/i18n/routing'

const TOKEN = /\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*([^*\n]+)\*\*/g
const INTERNAL_HREF = /^\/dashboard(?:\/[\w-]+)*\/?(?:\?[\w=&%-]*)?$/

/**
 * Le modèle écrit en Markdown ; seuls les liens et le gras sont rendus. Un lien ne mène
 * qu'à une page du tableau de bord : une autre cible, inventée ou injectée par un
 * document lu, reste du texte brut.
 */
export function MessageText({ text }: { text: string }) {
  const nodes: ReactNode[] = []
  let last = 0

  for (const match of text.matchAll(TOKEN)) {
    const [raw, label, href, bold] = match
    nodes.push(text.slice(last, match.index))
    last = match.index + raw.length

    if (bold !== undefined) {
      nodes.push(<strong key={match.index}>{bold}</strong>)
    } else if (INTERNAL_HREF.test(href)) {
      nodes.push(
        <Link
          key={match.index}
          href={href}
          className="font-medium text-foreground underline underline-offset-2"
        >
          {label}
        </Link>
      )
    } else {
      nodes.push(raw)
    }
  }
  nodes.push(text.slice(last))

  return (
    <p className="whitespace-pre-wrap">
      {nodes.map((node, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: segments are derived from immutable text
        <Fragment key={index}>{node}</Fragment>
      ))}
    </p>
  )
}
