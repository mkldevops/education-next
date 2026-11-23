import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link } from '@/i18n/routing'
import { INTERNAL_HREF } from './internal-href'

const COMPONENTS: Components = {
  a: ({ href, children }) =>
    href && INTERNAL_HREF.test(href) ? (
      <Link href={href} className="font-medium text-foreground underline underline-offset-2">
        {children}
      </Link>
    ) : (
      <span>{children}</span>
    ),
  img: () => null,
  table: ({ children }) => (
    <div className="my-1 max-w-full overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-surface-2">{children}</thead>,
  tr: ({ children }) => <tr className="border-b border-border last:border-b-0">{children}</tr>,
  th: ({ children, style }) => (
    <th style={style} className="whitespace-nowrap px-2.5 py-1.5 font-semibold">
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td style={style} className="px-2.5 py-1.5 align-top tabular-nums">
      {children}
    </td>
  ),
}

/**
 * Réponse du modèle rendue en Markdown (GFM : tableaux, listes, titres). Le HTML brut
 * n'est pas interprété et les images sont ignorées. Un lien ne mène qu'à une page du
 * tableau de bord : une autre cible, inventée ou injectée par un document lu, ne garde
 * que son libellé.
 */
export function MessageText({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2 wrap-break-word [&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1 [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
      <Markdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {text}
      </Markdown>
    </div>
  )
}
