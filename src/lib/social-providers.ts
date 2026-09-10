/**
 * Sans identifiants OAuth, aucun réglage plateforme ne doit faire apparaître un bouton
 * Google : `betterAuth` reçoit des chaînes vides et la redirection échouerait.
 */
export const isGoogleConfigured =
  Boolean(process.env.GOOGLE_CLIENT_ID) && Boolean(process.env.GOOGLE_CLIENT_SECRET)
