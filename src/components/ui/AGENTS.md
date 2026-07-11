# UI Primitives

This directory contains reusable local Tailwind primitives exposed through the `@peaklab/ui` alias.
They are not uniformly Radix or generated shadcn wrappers.

## Component Model

Keep primitives server-compatible unless state, context, event coordination, or browser APIs require
`'use client'`. `button/button.tsx` is server-compatible; `dialog/dialog.tsx` is a client component.

Compose class names with the local `cn()` helper and use CVA for reusable variants:

```typescript
const buttonVariants = cva('inline-flex items-center ...', {
  variants: { variant: { default: '...', destructive: '...' } },
})

<button className={cn(buttonVariants({ variant, size, className }))} {...props} />
```

Extend native element props where appropriate, preserve generic APIs such as `DataTable<T>`, and keep
feature-specific translations and business behavior in callers.

## Public Exports

Export a public primitive and its types from the nearest directory `index.ts`, then from
`src/components/ui/index.ts`. Prefer `@peaklab/ui` for the public barrel, but preserve an area's
existing deep-import style unless import standardization is part of the task.

The checked-in components are owned by this repository. Inspect their actual props before assuming a
shadcn or Radix API from `components.json`.
