/**
 * Splits a legacy free-text emergency contact into a name and a phone.
 *
 * Mirrors the back-fill in
 * prisma/migrations/20260806090000_split_family_emergency_contact/migration.sql.
 * Both are exercised by the same fixture table, so keep them in step.
 *
 * Ambiguous values are kept whole as the name rather than split badly: an
 * unstructured value stays fixable by an admin, a mangled name with an
 * unusable number does not.
 */

const PHONE_ONLY = /^\+?[0-9][0-9 .()-]*$/
const SEPARATOR_SPLIT = /^(.*[^\s|,:;/-])\s*[|,:;/-]\s*(\+?[0-9][0-9 .()-]*)$/
const WHITESPACE_SPLIT = /^(.*[^\s\d])\s+(\+?[0-9][0-9 .()-]*)$/
const LEADING_SPLIT = /^(\+?[0-9][0-9 .()-]*[0-9])\s*[|,:;/-]?\s*(.*\S)$/
const TRAILING_SEPARATORS = /[\s|,:;/-]+$/
const HAS_LETTER = /\p{L}/u

function isUsablePhone(value) {
  return value.length <= 20 && value.replace(/\D/g, '').length >= 6
}

function cleanName(value) {
  return value.trim().replace(TRAILING_SEPARATORS, '')
}

export function splitEmergencyContact(value) {
  const raw = (value ?? '').trim()
  if (!raw) return { name: null, phone: null }

  if (PHONE_ONLY.test(raw) && isUsablePhone(raw)) {
    return { name: null, phone: raw }
  }

  const separator = raw.match(SEPARATOR_SPLIT)
  if (separator && HAS_LETTER.test(separator[1]) && isUsablePhone(separator[2])) {
    return { name: cleanName(separator[1]), phone: separator[2] }
  }

  const whitespace = raw.match(WHITESPACE_SPLIT)
  if (whitespace && HAS_LETTER.test(whitespace[1]) && isUsablePhone(whitespace[2])) {
    return { name: cleanName(whitespace[1]), phone: whitespace[2] }
  }

  const leading = raw.match(LEADING_SPLIT)
  if (leading && HAS_LETTER.test(leading[2]) && isUsablePhone(leading[1])) {
    return { name: cleanName(leading[2]), phone: leading[1] }
  }

  return { name: raw, phone: null }
}
