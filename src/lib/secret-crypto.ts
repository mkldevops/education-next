import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_BYTES = 32
const IV_BYTES = 12
const TAG_BYTES = 16
const FORMAT = 'v1'

/**
 * Clé de chiffrement des secrets au repos, lue dans `SETTINGS_ENCRYPTION_KEY`.
 *
 * 32 octets en hexadécimal (64 caractères) ou en base64. Elle ne vit que dans
 * l'environnement : la base ne contient jamais de quoi déchiffrer ce qu'elle stocke, et une
 * sauvegarde seule ne livre pas la clé OpenRouter.
 */
type SecretEnv = { readonly [name: string]: string | undefined }

function readKey(env: SecretEnv = process.env): Buffer | null {
  const raw = env.SETTINGS_ENCRYPTION_KEY?.trim()
  if (!raw) return null

  const decoded = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, 'hex')
    : Buffer.from(raw, 'base64')
  return decoded.length === KEY_BYTES ? decoded : null
}

export function isSecretEncryptionConfigured(env: SecretEnv = process.env): boolean {
  return readKey(env) !== null
}

/**
 * AES-256-GCM avec un IV aléatoire par écriture ; le tag authentifie le texte chiffré, donc
 * une valeur altérée en base est refusée plutôt que déchiffrée en bruit.
 */
export function encryptSecret(
  plain: string,
  env: SecretEnv = process.env
): string | 'notConfigured' {
  const key = readKey(env)
  if (!key) return 'notConfigured'

  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [FORMAT, iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(
    ':'
  )
}

/**
 * `unreadable` couvre à la fois une clé d'environnement absente ou changée et une valeur
 * corrompue : dans les deux cas le secret est perdu pour l'application, et la seule sortie
 * est de le ressaisir.
 */
export function decryptSecret(
  stored: string,
  env: SecretEnv = process.env
): string | 'notConfigured' | 'unreadable' {
  const key = readKey(env)
  if (!key) return 'notConfigured'

  const [format, iv, tag, encrypted] = stored.split(':')
  if (format !== FORMAT || !iv || !tag || !encrypted) return 'unreadable'

  // GCM accepte des tags tronqués (4 à 16 octets) si on le laisse faire ; un tag court
  // affaiblit l'authentification, donc seule la longueur écrite par `encryptSecret` passe.
  const tagBytes = Buffer.from(tag, 'base64')
  if (tagBytes.length !== TAG_BYTES) return 'unreadable'

  try {
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64'), {
      authTagLength: TAG_BYTES,
    })
    decipher.setAuthTag(tagBytes)
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    return 'unreadable'
  }
}
