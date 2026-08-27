type DateInput = Date | string | number

export function formatDate(value: DateInput, locale: string) {
  return new Date(value).toLocaleDateString(locale)
}

export function formatDateLong(value: DateInput, locale: string) {
  return new Date(value).toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(value: DateInput, locale: string) {
  return new Date(value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })
}
