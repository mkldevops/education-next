/**
 * Gabarit HTML partagé des emails transactionnels.
 *
 * Module **pur** : aucune dépendance base de données, réseau ou server-only, afin
 * de rester testable et utilisable depuis un callback d'authentification comme
 * depuis un Server Action.
 *
 * Contraintes propres à l'email, qui expliquent le style du markup :
 * - mise en page en `<table>` et styles *inline* : Outlook (moteur Word) ignore
 *   flexbox, grid et la majorité des règles d'une feuille de style externe ;
 * - le bouton est doublé d'un rendu VML, seul moyen d'obtenir un fond et des
 *   coins arrondis sous Outlook Windows ;
 * - les polices distinctives sont servies par `<link>` — honorées par Apple Mail
 *   et iOS, ignorées par Gmail — d'où une pile de repli explicite ;
 * - le pré-en-tête est un bloc masqué : c'est le texte d'aperçu des listes de
 *   messages, sinon rempli par le début du contenu.
 *
 * Le thème reprend la palette de l'école (`@/lib/theme`).
 */
import { palette, semantic } from '@/lib/theme'

const CANVAS = palette['stormy-teal'][200]
const INK = palette.graphite[300]
const BODY_TEXT = palette.graphite[500]
const MUTED_TEXT = palette.graphite[700]
const RULE = palette.alabaster.DEFAULT
const ACCENT = semantic.primary
const ACCENT_DEEP = palette['stormy-teal'][400]
const SECONDARY = semantic.secondary
const PAPER = palette.white.DEFAULT

const DISPLAY_FONT = "'Fraunces', 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif"
const BODY_FONT =
  "'Karla', 'Avenir Next', 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif"

type EmailCta = {
  label: string
  url: string
}

export type EmailLayoutInput = {
  /** Texte d'aperçu affiché par le client de messagerie avant ouverture. */
  preheader: string
  /** Sur-titre en petites capitales — identité de l'école ou de la plateforme. */
  brand: string
  logoUrl?: string
  heading: string
  /** Paragraphes du corps, dans l'ordre. */
  paragraphs: string[]
  cta?: EmailCta
  /** Mention d'expiration ou d'avertissement, mise en évidence sous le bouton. */
  notice?: string
  footer?: string
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/**
 * Les valeurs injectées viennent de données utilisateur (nom d'école, libellés
 * traduits, URL de logo) : elles sont échappées, faute de quoi un nom contenant
 * `<` ou `"` casserait le document ou injecterait du markup dans les clients
 * qui n'assainissent pas le HTML reçu.
 */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] as string)
}

/**
 * Seuls `http(s)` sont conservés : une URL `javascript:` ou `data:` placée dans un
 * `href` reste exploitable dans les clients de messagerie permissifs, et le lien
 * apparaît ici trois fois (logo, bouton HTML, bouton VML).
 */
function safeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? escapeHtml(url) : '#'
}

export function renderEmailLayout(input: EmailLayoutInput): string {
  const { preheader, brand, logoUrl, heading, paragraphs, cta, notice, footer } = input

  const logoCell = logoUrl
    ? `<td width="44" style="width:44px;padding-right:16px;"><img src="${safeUrl(logoUrl)}" width="44" height="44" alt="${escapeHtml(brand)}" style="display:block;border:0;outline:none;text-decoration:none;border-radius:10px;background:${PAPER};" /></td>`
    : ''

  const body = paragraphs
    .map(
      (text, index) =>
        `<p style="margin:0 0 ${index === paragraphs.length - 1 ? 28 : 16}px;font-family:${BODY_FONT};font-size:16px;line-height:26px;color:${BODY_TEXT};">${escapeHtml(text)}</p>`
    )
    .join('\n              ')

  const ctaUrl = cta ? safeUrl(cta.url) : ''
  const ctaLabel = cta ? escapeHtml(cta.label) : ''
  const button = cta
    ? `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0;">
                <tr>
                  <td align="center" bgcolor="${ACCENT}" style="border-radius:2px;box-shadow:7px 7px 0 0 ${SECONDARY};">
                    <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${ctaUrl}" style="height:50px;v-text-anchor:middle;width:290px;" arcsize="4%" strokecolor="${ACCENT_DEEP}" fillcolor="${ACCENT}"><w:anchorlock/><center style="color:${PAPER};font-family:Arial,sans-serif;font-size:14px;font-weight:bold;letter-spacing:1px;">${ctaLabel}</center></v:roundrect><![endif]-->
                    <!--[if !mso]><!-- -->
                    <a href="${ctaUrl}" style="display:inline-block;padding:17px 34px;font-family:${BODY_FONT};font-size:14px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${PAPER};text-decoration:none;">${ctaLabel}</a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>`
    : ''

  const noticeBlock = notice
    ? `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:34px 0 0;">
                <tr>
                  <td width="3" bgcolor="${ACCENT}" style="width:3px;font-size:0;line-height:0;">&nbsp;</td>
                  <td style="padding:2px 0 2px 14px;font-family:${BODY_FONT};font-size:13px;line-height:20px;letter-spacing:0.3px;color:${MUTED_TEXT};">${escapeHtml(notice)}</td>
                </tr>
              </table>`
    : ''

  const footerRow = footer
    ? `
          <tr>
            <td class="gutter" style="padding:24px 40px 34px;border-top:1px solid ${RULE};font-family:${BODY_FONT};font-size:12px;line-height:19px;color:${MUTED_TEXT};">${escapeHtml(footer)}</td>
          </tr>`
    : ''

  return `<!doctype html>
<html lang="fr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(heading)}</title>
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Karla:wght@400;500;700&display=swap" rel="stylesheet" />
  <style>
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
    @media (max-width: 620px) {
      .shell { width: 100% !important; }
      .gutter { padding-left: 24px !important; padding-right: 24px !important; }
      .display { font-size: 28px !important; line-height: 34px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${CANVAS};">
  <div style="display:none;font-size:1px;color:${CANVAS};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${CANVAS};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" class="shell" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;background:${PAPER};">
          <tr>
            <td bgcolor="${ACCENT}" height="5" style="height:5px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td bgcolor="${INK}" class="gutter" style="padding:26px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  ${logoCell}<td style="font-family:${BODY_FONT};font-size:11px;font-weight:700;letter-spacing:3.4px;text-transform:uppercase;color:${palette['stormy-teal'][800]};">${escapeHtml(brand)}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="gutter" style="padding:44px 40px 44px;">
              <h1 class="display" style="margin:0 0 22px;font-family:${DISPLAY_FONT};font-size:34px;line-height:40px;font-weight:600;letter-spacing:-0.4px;color:${INK};">${escapeHtml(heading)}</h1>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;">
                <tr>
                  <td width="56" bgcolor="${ACCENT}" height="2" style="width:56px;height:2px;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
              ${body}${button}${noticeBlock}
            </td>
          </tr>${footerRow}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/** Variante texte brut du même contenu, pour les clients sans HTML. */
export function renderEmailText(input: EmailLayoutInput): string {
  const { brand, heading, paragraphs, cta, notice, footer } = input

  return [
    brand.toUpperCase(),
    '',
    heading,
    '',
    ...paragraphs,
    ...(cta ? ['', `${cta.label} : ${cta.url}`] : []),
    ...(notice ? ['', notice] : []),
    ...(footer ? ['', '--', footer] : []),
  ].join('\n')
}
