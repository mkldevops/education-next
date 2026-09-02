/**
 * Page où atterrir après une bascule d'école.
 *
 * Une page de détail nomme une ressource de l'école quittée : la rejouer telle quelle
 * renverrait l'écran de lien profond proposant de revenir en arrière, soit l'inverse de
 * ce que la bascule vient de demander. On remonte donc à la liste de la section, qui,
 * elle, se relit dans n'importe quelle école. Les pages de section et hors tableau de
 * bord restent en place.
 */
export function schoolSwitchLanding(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean)
  if (segments[0] !== 'dashboard' || segments.length < 3) return pathname

  return `/dashboard/${segments[1]}`
}
