'use client'

import { useEffect } from 'react'
import { rememberActiveSchoolAction } from '@/actions/school-actions'

/**
 * Un Server Component ne peut pas écrire de cookie : le rendu du dashboard délègue donc
 * l'écriture à cette action, déclenchée seulement quand le cookie ne désigne pas déjà
 * l'école affichée.
 */
export function RememberActiveSchool() {
  useEffect(() => {
    void rememberActiveSchoolAction()
  }, [])

  return null
}
