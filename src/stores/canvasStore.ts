import { create } from 'zustand';

export interface Artifact {
  id: string;
  title: string;
  type: string; // e.g., 'html', 'code', 'mermaid', 'markdown'
  content: string;
  identifier?: string;
}

interface CanvasState {
  isOpen: boolean;
  activeArtifact: Artifact | null;
  versions: Artifact[];
  openArtifact: (artifact: Artifact) => void;
  closeCanvas: () => void;
  updateArtifact: (content: string) => void;
  registerArtifact: (artifact: Artifact) => void;
  setVersion: (id: string) => void;
  clearSession: () => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  isOpen: false,
  activeArtifact: null,
  versions: [],
  
  openArtifact: (artifact) => 
    set((state) => {
      const existingIdx = state.versions.findIndex(v => v.id === artifact.id);
      const newVersions = [...state.versions];
      if (existingIdx === -1) {
        newVersions.push(artifact);
      } else {
        newVersions[existingIdx] = artifact;
      }
      return { isOpen: true, activeArtifact: artifact, versions: newVersions };
    }),
    
  closeCanvas: () => set({ isOpen: false }),
  
  updateArtifact: (content) => 
    set((state) => {
      if (!state.activeArtifact) return state;
      const updated = { ...state.activeArtifact, content };
      const newVersions = state.versions.map(v => v.id === updated.id ? updated : v);
      return {
        activeArtifact: updated,
        versions: newVersions
      };
    }),
    
  registerArtifact: (artifact) => 
    set((state) => {
      const existingIdx = state.versions.findIndex(v => v.id === artifact.id);
      if (existingIdx !== -1 && state.versions[existingIdx].content === artifact.content) {
        return state; // Prevent infinite loop if already registered
      }
      
      const newVersions = [...state.versions];
      if (existingIdx === -1) {
        newVersions.push(artifact);
      } else {
        newVersions[existingIdx] = artifact;
      }
      
      // If the registered artifact is the active one, update it as well
      let active = state.activeArtifact;
      if (active && active.id === artifact.id) {
        active = artifact;
      }
      
      return { versions: newVersions, activeArtifact: active };
    }),
    
  setVersion: (id) => 
    set((state) => {
      const target = state.versions.find(v => v.id === id);
      if (target) {
        return { activeArtifact: target };
      }
      return state;
    }),
    
  clearSession: () => set({ isOpen: false, activeArtifact: null, versions: [] }),
}));
