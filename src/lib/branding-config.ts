export const BRANDING_CONFIG_KEYS = {
  logoUrl: 'logo_url',
  faviconUrl: 'favicon_url',
} as const

export const SCHOOL_NAME_CONFIG_KEY = 'school_name'

export const BRANDING_CONFIG_DEFAULTS = [
  {
    name: BRANDING_CONFIG_KEYS.logoUrl,
    value: '',
    valueType: 'TEXT',
  },
  {
    name: BRANDING_CONFIG_KEYS.faviconUrl,
    value: '',
    valueType: 'TEXT',
  },
] as const
