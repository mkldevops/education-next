---
paths:
  - "src/features/**/*store.ts"
  - "src/features/**/*.tsx"
---

# Zustand Rules

Scope: src/features/**/*store.ts, src/features/**/*.tsx

## Proactive Behavior

Use Zustand for client-only UI state that must be shared across components. Keep server data in
Server Components or the existing data-access flow.

## Store Pattern

Type store state explicitly and keep actions with the state they update:

```typescript
type SidebarState = {
  expanded: boolean
  toggle: () => void
}

export const useSidebarStore = create<SidebarState>()((set) => ({
  expanded: true,
  toggle: () => set((state) => ({ expanded: !state.expanded })),
}))
```

Persist only values that must survive reloads. The sidebar store persists `expanded` but deliberately
does not persist transient mobile state.

When a store grows or updates frequently, select only the required fields to avoid unrelated
re-renders. Do not add store middleware or a slice architecture until the state complexity requires
it.
