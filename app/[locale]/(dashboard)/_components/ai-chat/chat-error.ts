/**
 * Le code d'erreur voyage soit dans le corps JSON d'un refus (`{ error }`), soit comme
 * texte d'un chunk d'erreur du flux ; dans les deux cas le message ne contient qu'un code.
 */
export function chatErrorCode(error: Error): string {
  try {
    const parsed: unknown = JSON.parse(error.message)
    if (typeof parsed === 'object' && parsed !== null && 'error' in parsed) {
      const code = (parsed as { error: unknown }).error
      if (typeof code === 'string') return code
    }
  } catch {
    // message brut
  }
  return error.message
}
