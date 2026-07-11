---
paths:
  - "**/*.css"
  - "**/*.tsx"
  - "postcss.config.mjs"
---

# Tailwind CSS 4 Rules

Scope: **/*.css, **/*.tsx, postcss.config.mjs

## Proactive Behavior

Reuse the theme tokens in `src/styles/globals.css` before adding colors, fonts, spacing, or arbitrary
values. Keep Tailwind 4 configuration CSS-first.

## Theme and Configuration

The project imports Tailwind with `@import 'tailwindcss'` and defines tokens in `@theme`. Add new theme
tokens there; do not create a `tailwind.config.ts` for ordinary colors or typography.

```css
@theme {
  --color-primary: var(--theme-primary, #3c6e71);
  --color-primary-hover: var(--theme-primary-hover, #30595b);
}
```

`postcss.config.mjs` uses `@tailwindcss/postcss`; do not add legacy Autoprefixer configuration.

## Component Classes

Follow the surrounding component's established token form, compose conditional classes with `cn()`,
and use CVA for reusable variants. Prefer canonical utilities such as `h-10`, `shrink-0`, and `gap-2`
when they express the required value; use arbitrary values only for genuinely nonstandard dimensions.

Do not add one-off hard-coded colors when an existing semantic or palette token expresses the same
meaning.
