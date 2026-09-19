import { DAY_MS } from './day'

const FOLD_LIMIT = 75
// 2020-01-01T00:00:00Z : toute date `updatedAt` de l'application lui est postérieure, donc
// SEQUENCE reste positive ; repousse le dépassement de l'INTEGER 32 bits signé de la RFC
// (2 147 483 647 s) de 1970 à environ 2088, loin de la portée de cette application.
const ICS_SEQUENCE_EPOCH_MS = Date.UTC(2020, 0, 1)

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

/**
 * RFC 5545 §3.1 : une ligne ne devrait pas dépasser 75 octets (hors saut de ligne), pliée
 * par un CRLF suivi d'un espace de continuation. Le découpage compte des OCTETS UTF-8, pas
 * des unités UTF-16 : un titre accentué ('é', 'à'…) verrait sinon un caractère multi-octets
 * coupé en deux à la frontière du pli, corrompu pour tout lecteur qui déplie strictement le
 * flux. `budget` retombe à 74 après la première ligne : l'espace de continuation occupe le
 * 75ᵉ octet de chaque ligne physique suivante.
 */
/** UTF-8 : un octet de continuation a la forme binaire `10xxxxxx`. */
function isUtf8ContinuationByte(byte: number | undefined): boolean {
  return byte !== undefined && (byte & 0xc0) === 0x80
}

function foldIcsLine(line: string): string {
  const bytes = textEncoder.encode(line)
  if (bytes.length <= FOLD_LIMIT) return line

  const parts: string[] = []
  let start = 0
  let budget = FOLD_LIMIT
  while (start < bytes.length) {
    let end = Math.min(start + budget, bytes.length)
    while (end < bytes.length && isUtf8ContinuationByte(bytes[end])) end -= 1
    parts.push(textDecoder.decode(bytes.subarray(start, end)))
    start = end
    budget = FOLD_LIMIT - 1
  }
  return parts.join('\r\n ')
}

/**
 * RFC 5545 §3.3.11. L'ordre importe : échapper `\` en premier, sinon les échappements
 * introduits par les remplacements suivants seraient eux-mêmes ré-échappés.
 */
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function formatIcsDateOnly(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`
}

function formatIcsDateTimeUtc(date: Date): string {
  const time = `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`
  return `${formatIcsDateOnly(date)}T${time}Z`
}

function icsLine(name: string, value: string): string {
  return foldIcsLine(`${name}:${value}`)
}

export type IcsEvent = {
  id: string
  title: string
  summary: string | null
  description: string | null
  location: string | null
  status: 'PUBLISHED' | 'CANCELLED'
  allDay: boolean
  startAt: Date
  endAt: Date | null
  updatedAt: Date
}

export type IcsSchool = {
  slug: string
  name: string
}

function buildVEventLines(schoolSlug: string, event: IcsEvent, now: Date): string[] {
  const lines = [
    icsLine('BEGIN', 'VEVENT'),
    // Stable : le même événement édité redonne le même UID, donc les clients de calendrier
    // mettent à jour l'entrée existante au lieu d'en créer une seconde.
    icsLine('UID', `${event.id}@${schoolSlug}`),
    icsLine('DTSTAMP', formatIcsDateTimeUtc(now)),
  ]

  if (event.allDay) {
    lines.push(icsLine('DTSTART;VALUE=DATE', formatIcsDateOnly(event.startAt)))
    // DTEND est EXCLUSIF en VALUE=DATE (RFC 5545 §3.6.1), alors que `endAt` stocke le
    // dernier jour INCLUS (`normalizeEventDates`, doctrine du modèle `Event`) : +1 jour.
    // Sans `endAt` (événement d'un seul jour), DTEND est omis : la RFC fixe alors la durée
    // par défaut à un jour, exactement le comportement voulu.
    if (event.endAt) {
      const exclusiveEnd = new Date(event.endAt.getTime() + DAY_MS)
      lines.push(icsLine('DTEND;VALUE=DATE', formatIcsDateOnly(exclusiveEnd)))
    }
  } else {
    lines.push(icsLine('DTSTART', formatIcsDateTimeUtc(event.startAt)))
    if (event.endAt) lines.push(icsLine('DTEND', formatIcsDateTimeUtc(event.endAt)))
  }

  lines.push(icsLine('SUMMARY', escapeIcsText(event.title)))

  const description = event.description ?? event.summary
  if (description) lines.push(icsLine('DESCRIPTION', escapeIcsText(description)))
  if (event.location) lines.push(icsLine('LOCATION', escapeIcsText(event.location)))

  lines.push(icsLine('STATUS', event.status === 'CANCELLED' ? 'CANCELLED' : 'CONFIRMED'))
  // SEQUENCE dérivée de `updatedAt`, en secondes depuis une époque fixe du projet — pas
  // l'époque Unix 1970, dont les secondes dépasseraient l'INTEGER 32 bits signé de la RFC
  // (2 147 483 647) le 2038-01-19 ; un client qui stocke SEQUENCE ainsi repasserait en
  // négatif et ignorerait alors toute édition ultérieure. Reste monotone croissante tant
  // que l'horloge ne recule pas, donc chaque modification l'augmente sans compteur séparé
  // à faire persister.
  lines.push(
    icsLine(
      'SEQUENCE',
      String(Math.floor((event.updatedAt.getTime() - ICS_SEQUENCE_EPOCH_MS) / 1000))
    )
  )
  lines.push(icsLine('LAST-MODIFIED', formatIcsDateTimeUtc(event.updatedAt)))
  lines.push(icsLine('END', 'VEVENT'))

  return lines
}

/**
 * Sérialiseur pur RFC 5545, sans I/O : la route ICS ne fait que projeter les événements
 * publics vers `IcsEvent` et appeler cette fonction. `now` est injectable pour les tests
 * (DTSTAMP) ; en production c'est l'instant de génération du flux, distinct de
 * `LAST-MODIFIED` qui porte la dernière modification de l'événement lui-même.
 */
export function buildEventsIcsFeed(
  school: IcsSchool,
  events: IcsEvent[],
  now: Date = new Date()
): string {
  const lines = [
    icsLine('BEGIN', 'VCALENDAR'),
    icsLine('VERSION', '2.0'),
    icsLine('PRODID', '-//education-next//events//FR'),
    icsLine('CALSCALE', 'GREGORIAN'),
    // Extension `X-WR-CALNAME`, non normative mais largement reconnue (Apple Calendar,
    // Google Calendar, Outlook) : sans elle, le calendrier importé porte un nom générique
    // illisible au lieu du nom de l'école.
    icsLine('X-WR-CALNAME', escapeIcsText(school.name)),
  ]

  for (const event of events) lines.push(...buildVEventLines(school.slug, event, now))

  lines.push(icsLine('END', 'VCALENDAR'))

  return `${lines.join('\r\n')}\r\n`
}
