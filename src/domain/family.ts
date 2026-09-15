export function validateFamilyName(name: string): 'OK' | 'validationError' {
  if (!name || name.trim().length === 0) {
    return 'validationError'
  }

  if (name.length > 50) {
    return 'validationError'
  }

  return 'OK'
}

/**
 * Langues parlées à la maison, déclarées pour la famille entière et toujours facultatives.
 * La saisie est une liste libre séparée par des virgules ; doublons et entrées vides tombent.
 */
export function parseLanguagesAtHome(value: string | null | undefined): string[] {
  const languages = (value ?? '')
    .split(',')
    .map((language) => language.trim())
    .filter(Boolean)
  return [...new Set(languages)]
}

/** Lit la colonne JSON `Family.languagesAtHome`, tolérante à une valeur inattendue. */
export function languagesOf(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((language): language is string => typeof language === 'string')
    : []
}
