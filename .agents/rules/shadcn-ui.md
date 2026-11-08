---

paths:

- "src/components/**"
- "**/*.tsx"
- "components.json"

---

# UI Primitive Rules

Scope: src/components/**, **/*.tsx, components.json

## Proactive Behavior

Inspect the checked-in component before using it. `components.json` records shadcn-compatible paths
and styling, but the current UI primitives are local implementations and are not uniformly Radix or
generated shadcn components.

## Composition and Styling

Keep primitives server-compatible unless hooks, context, or browser APIs require `'use client'`.
Compose class names with the local `cn()` helper and define reusable variants with CVA.

Do not assume props such as `asChild`, `DialogTrigger`, or Radix accessibility behavior unless the
local component implements them. Preserve native element props, keyboard behavior, focus management,
and accessible names when changing interactive primitives.

## Exports

Export public primitives and types from the nearest directory `index.ts`, then from
`src/components/ui/index.ts`. The `@peaklab/ui` alias targets that barrel. Keep feature-specific
translation, data access, and business behavior outside the primitive layer.
