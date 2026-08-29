import { db } from '@/lib/db'

/**
 * `User.email` n'est écrit qu'en minuscules par l'application, et l'index unique de
 * Postgres est sensible à la casse. L'adresse portée par une invitation est donc
 * abaissée avant toute lecture ou création de compte, plutôt que cherchée sans tenir
 * compte de la casse : `findUnique` n'accepte pas `mode`, et un `ILIKE` n'utiliserait
 * pas l'index. Une invitation émise avant cette règle peut encore porter une casse
 * mixte, d'où l'abaissement à la lecture et non seulement à l'émission.
 */
export const normalizeEmail = (email: string) => email.toLowerCase()

export const findAccountByEmail = (email: string) =>
  db.user.findUnique({ where: { email: normalizeEmail(email) }, select: { id: true } })
