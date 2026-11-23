import { mcpAppDocument } from './view-shell'

export const OVERDUE_VIEW_URI = 'ui://education/overdue.html'

const STYLE = `
.head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 12px;padding:12px 14px;border-bottom:1px solid var(--line)}
.total{font-size:20px;font-weight:600;color:var(--danger)}
.sub{color:var(--muted);font-size:12px}
.list{max-height:420px;overflow-y:auto}
.row{display:flex;align-items:center;gap:12px;width:100%;padding:10px 14px;border:0;border-bottom:1px solid var(--line);background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
.row:last-child{border-bottom:0}
.row:hover{background:var(--hover)}
.who{flex:1;min-width:0}
.name{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kids{color:var(--muted);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.amount{font-weight:600;color:var(--danger);font-variant-numeric:tabular-nums;white-space:nowrap}
.bar{height:4px;margin-top:6px;border-radius:2px;background:var(--danger-soft);overflow:hidden}
.bar>i{display:block;height:100%;background:var(--danger)}
`

/**
 * Vue de `list_overdue_students` : une ligne par famille redevable, triée par retard,
 * avec ses enfants et leur classe. Une ligne ouvre la fiche de la famille.
 */
const SCRIPT = `
const I18N = {
  fr: { title: 'Impayés', families: (n) => n + (n > 1 ? ' familles' : ' famille') + ' en retard',
        students: (n) => n + (n > 1 ? ' élèves' : ' élève'), none: 'Aucun impayé à ce jour.',
        disabled: 'Le suivi des paiements est désactivé pour cette école.', error: 'Lecture impossible.',
        archived: 'parti' },
  en: { title: 'Overdue', families: (n) => n + (n > 1 ? ' families' : ' family') + ' overdue',
        students: (n) => n + (n > 1 ? ' students' : ' student'), none: 'Nothing overdue today.',
        disabled: 'Payment tracking is turned off for this school.', error: 'Could not read the data.',
        archived: 'left' },
}

function render(result, context) {
  const lang = String(context.locale || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr'
  const t = I18N[lang]
  const root = document.getElementById('app')
  root.replaceChildren()
  const data = readResult(result)
  if (!data || data.error) {
    root.append(el('p', 'empty', data && data.error === 'paymentsDisabled' ? t.disabled : t.error))
    return
  }
  const money = new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'fr-FR', {
    style: 'currency', currency: data.currency || 'EUR',
  })
  const families = new Map()
  for (const student of data.students || []) {
    const entry = families.get(student.family.id) || { family: student.family, kids: [] }
    const classes = (student.classes || []).map((c) => c.name).join(', ')
    const label = student.name + (classes ? ' (' + classes + ')' : '') + (student.archived ? ' · ' + t.archived : '')
    entry.kids.push(label)
    families.set(student.family.id, entry)
  }
  if (families.size === 0) {
    root.append(el('p', 'empty', t.none))
    return
  }
  const card = el('section', 'card')
  const head = el('div', 'head')
  const left = el('div')
  left.append(el('div', 'sub', t.title), el('div', 'total', money.format(data.totalOverdueAmount || 0)))
  head.append(left, el('div', 'sub', t.families(families.size) + ' · ' + t.students(data.total || 0)))
  const list = el('div', 'list')
  const max = Math.max(...[...families.values()].map((e) => e.family.overdueAmount || 0), 1)
  for (const { family, kids } of families.values()) {
    const row = el('button', 'row')
    row.type = 'button'
    const who = el('div', 'who')
    who.append(el('div', 'name', family.name), el('div', 'kids', kids.join(', ')))
    const bar = el('div', 'bar')
    const fill = document.createElement('i')
    fill.style.width = Math.round(((family.overdueAmount || 0) / max) * 100) + '%'
    bar.append(fill)
    who.append(bar)
    row.append(who, el('div', 'amount', money.format(family.overdueAmount || 0)))
    row.addEventListener('click', () => openLink('/dashboard/families/' + encodeURIComponent(family.id)))
    list.append(row)
  }
  card.append(head, list)
  root.append(card)
}
`

/** Document HTML autonome de la vue ; `origin` préfixe les liens hors de l'application. */
export function overdueViewHtml(origin: string): string {
  return mcpAppDocument({ title: 'Impayés', origin, style: STYLE, script: SCRIPT })
}
