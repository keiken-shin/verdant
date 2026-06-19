import { create } from 'zustand';

interface UiStore {
  searchOpen: boolean;
  graphPanelOpen: boolean;
  sidebarCollapsed: boolean;

  openSearch: () => void;
  closeSearch: () => void;
  toggleSearch: () => void;
  toggleGraphPanel: () => void;
  setGraphPanelOpen: (v: boolean) => void;
  toggleSidebar: () => void;
}

export const useUiStore = create<UiStore>((set) => ({
  searchOpen: false,
  graphPanelOpen: false,
  sidebarCollapsed: false,

  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
  toggleSearch: () => set((state) => ({ searchOpen: !state.searchOpen })),
  toggleGraphPanel: () => set((state) => ({ graphPanelOpen: !state.graphPanelOpen })),
  setGraphPanelOpen: (v) => set({ graphPanelOpen: v }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));
