/** Astérisque des champs obligatoires, masqué aux lecteurs d'écran : `required` le dit déjà. */
export function RequiredMark() {
  return (
    <span aria-hidden className="text-red-500">
      {' '}
      *
    </span>
  )
}
