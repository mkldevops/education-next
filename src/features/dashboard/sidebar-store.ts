import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { NavScope } from './sidebar-items'

type SidebarState = {
  expanded: boolean
  toggle: () => void
  mobileOpen: boolean
  setMobileOpen: (v: boolean) => void
  toggleMobile: () => void
  /**
   * Portée de navigation publiée par la barre latérale, relue par la palette ⌘K pour proposer
   * exactement les mêmes destinations. Jamais persistée : elle suit la session serveur.
   */
  navScope: NavScope | null
  setNavScope: (scope: NavScope) => void
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      expanded: true,
      toggle: () => set((s) => ({ expanded: !s.expanded })),
      mobileOpen: false,
      setMobileOpen: (v) => set({ mobileOpen: v }),
      toggleMobile: () => set((s) => ({ mobileOpen: !s.mobileOpen })),
      navScope: null,
      setNavScope: (navScope) => set({ navScope }),
    }),
    {
      name: 'sidebar-state',
      partialize: (state) => ({ expanded: state.expanded }),
    }
  )
)
