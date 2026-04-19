import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type SidebarState = {
  expanded: boolean
  toggle: () => void
  mobileOpen: boolean
  setMobileOpen: (v: boolean) => void
  toggleMobile: () => void
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      expanded: true,
      toggle: () => set((s) => ({ expanded: !s.expanded })),
      mobileOpen: false,
      setMobileOpen: (v) => set({ mobileOpen: v }),
      toggleMobile: () => set((s) => ({ mobileOpen: !s.mobileOpen })),
    }),
    {
      name: 'sidebar-state',
      partialize: (state) => ({ expanded: state.expanded }),
    }
  )
)
