/** Le favicon n'a pas de réglage propre : il est généré depuis le logo par `app/icon.tsx`. */
export const BRANDING_CONFIG_KEYS = {
  logoUrl: 'logo_url',
} as const

export const BRANDING_CONFIG_DEFAULTS = [
  {
    name: BRANDING_CONFIG_KEYS.logoUrl,
    value: '',
    valueType: 'TEXT',
  },
] as const

/** Partagé avec le formulaire : un fichier trop lourd est refusé avant de partir vers le serveur. */
export const MAX_BRANDING_IMAGE_BYTES = 1024 * 1024
