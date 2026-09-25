/** Réglage plateforme gouvernant la bascule d'école pour toute l'instance. */
export const SCHOOL_SWITCH_SETTING = 'school_switch_enabled'

/** Réglage plateforme gouvernant la connexion Google pour toute l'instance. */
export const GOOGLE_SIGN_IN_SETTING = 'google_sign_in_enabled'

/** Réglage plateforme gouvernant la connexion par passkey pour toute l'instance. */
export const PASSKEY_SIGN_IN_SETTING = 'passkey_sign_in_enabled'

/** Réglage plateforme gouvernant le serveur MCP pour toute l'instance. */
export const MCP_ENABLED_SETTING = 'mcp_enabled'

/**
 * Réglage plateforme gouvernant l'assistant d'inscription pour toute l'instance.
 *
 * Distinct de la clé OpenRouter : couper l'assistant ne détruit pas la clé, et saisir la
 * clé n'ouvre pas l'assistant.
 */
export const AI_ASSISTANT_ENABLED_SETTING = 'ai_assistant_enabled'

/**
 * Clé OpenRouter de l'instance, stockée **chiffrée** : `PlatformSetting.value` est du texte
 * en clair, et une clé de fournisseur n'a rien à faire en clair dans une sauvegarde.
 */
export const OPENROUTER_API_KEY_SETTING = 'openrouter_api_key'
