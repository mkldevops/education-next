import { create } from 'zustand'

type SidebarState = {
  expanded: boolean
  toggle: () => void
}

export const useSidebarStore = create<SidebarState>((set) => ({
  expanded: true,
  toggle: () => set((s) => ({ expanded: !s.expanded })),
}))
