import Markdown from 'react-markdown'

/**
 * Corps d'une nouveauté, écrit en markdown dans Directus. `react-markdown` n'interprète pas le
 * HTML brut et neutralise les URL `javascript:` : le texte du CMS ne peut pas injecter de script.
 */
export function AnnouncementMarkdown({ children }: { children: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-graphite-600 [&_a]:text-primary [&_a]:underline [&_h2]:font-semibold [&_h2]:text-graphite [&_h3]:font-semibold [&_h3]:text-graphite [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:text-graphite [&_ul]:list-disc [&_ul]:pl-5">
      <Markdown
        components={{
          a: ({ href, children: label }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {label}
            </a>
          ),
          img: () => null,
        }}
      >
        {children}
      </Markdown>
    </div>
  )
}
