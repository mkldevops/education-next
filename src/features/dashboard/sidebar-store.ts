import { create } from 'zustand'

type SidebarState = {
  expanded: boolean
  toggle: () => void
  mobileOpen: boolean
  setMobileOpen: (v: boolean) => void
  toggleMobile: () => void
}

export const useSidebarStore = create<SidebarState>((set) => ({
  expanded: true,
  toggle: () => set((s) => ({ expanded: !s.expanded })),
  mobileOpen: false,
  setMobileOpen: (v) => set({ mobileOpen: v }),
  toggleMobile: () => set((s) => ({ mobileOpen: !s.mobileOpen })),
}))
