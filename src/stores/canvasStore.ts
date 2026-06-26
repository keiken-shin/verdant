import { create } from 'zustand';

export interface Artifact {
  id: string;
  title: string;
  type: string; // e.g., 'html', 'code', 'mermaid', 'markdown'
  content: string;
}

interface CanvasState {
  isOpen: boolean;
  activeArtifact: Artifact | null;
  openArtifact: (artifact: Artifact) => void;
  closeCanvas: () => void;
  updateArtifact: (content: string) => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  isOpen: false,
  activeArtifact: null,
  openArtifact: (artifact) => set({ isOpen: true, activeArtifact: artifact }),
  closeCanvas: () => set({ isOpen: false }),
  updateArtifact: (content) => 
    set((state) => ({
      activeArtifact: state.activeArtifact 
        ? { ...state.activeArtifact, content } 
        : null
    })),
}));
