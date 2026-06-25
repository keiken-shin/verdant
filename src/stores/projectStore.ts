import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Project, ProjectFile } from '@/types';

interface ProjectStore {
  projects: Project[];
  filesByProject: Record<string, ProjectFile[]>;
  loading: boolean;

  fetchProjects: () => Promise<void>;
  createProject: (name?: string, description?: string, instructions?: string) => Promise<Project>;
  updateProject: (id: string, data: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  touchProject: (id: string) => Promise<void>;
  searchProjects: (query: string) => Promise<Project[]>;

  fetchProjectFiles: (projectId: string) => Promise<void>;
  addProjectFile: (projectId: string, name: string, ext: string, size: number, objectId: string) => Promise<ProjectFile>;
  deleteProjectFile: (projectId: string, id: string) => Promise<void>;
  updateProjectFileMode: (projectId: string, id: string, mode: 'inline' | 'reference' | 'summary') => Promise<void>;
  updateProjectFileSummary: (projectId: string, id: string, summary: string) => Promise<void>;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  filesByProject: {},
  loading: false,

  fetchProjects: async () => {
    set({ loading: true });
    try {
      const projects = await invoke<Project[]>('get_projects');
      set({ projects, loading: false });
    } catch (e) {
      console.error('Failed to fetch projects:', e);
      set({ loading: false });
    }
  },

  createProject: async (name = 'Untitled Project', description, instructions) => {
    const project = await invoke<Project>('create_project', {
      input: { name, description, instructions },
    });
    set((state) => ({ projects: [project, ...state.projects] }));
    return project;
  },

  updateProject: async (id, data) => {
    await invoke('update_project', { id, input: data });
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, ...data } : p)),
    }));
  },

  deleteProject: async (id) => {
    await invoke('delete_project', { id });
    set((state) => ({ projects: state.projects.filter((p) => p.id !== id) }));
  },

  touchProject: async (id) => {
    await invoke('touch_project', { id });
    const now = new Date().toISOString();
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, last_opened_at: now } : p)),
    }));
  },

  searchProjects: async (query) => {
    if (!query.trim()) return get().projects;
    return await invoke<Project[]>('search_projects', { query });
  },

  fetchProjectFiles: async (projectId) => {
    const files = await invoke<ProjectFile[]>('get_project_files', { projectId });
    set((state) => ({ filesByProject: { ...state.filesByProject, [projectId]: files } }));
  },

  addProjectFile: async (projectId, name, ext, size, objectId) => {
    const file = await invoke<ProjectFile>('create_project_file', {
      input: { project_id: projectId, name, ext, size, object_id: objectId },
    });
    set((state) => ({
      filesByProject: {
        ...state.filesByProject,
        [projectId]: [file, ...(state.filesByProject[projectId] || [])],
      },
    }));
    return file;
  },

  deleteProjectFile: async (projectId, id) => {
    try {
      await invoke('delete_project_file', { id });
      set((state) => ({
        filesByProject: {
          ...state.filesByProject,
          [projectId]: (state.filesByProject[projectId] || []).filter((f) => f.id !== id),
        },
      }));
    } catch (e) {
      console.error('Failed to delete file:', e);
      throw e;
    }
  },
  
  updateProjectFileMode: async (projectId, id, mode) => {
    try {
      await invoke('update_project_file_mode', { id, mode });
      set((state) => {
        const files = state.filesByProject[projectId] || [];
        return {
          filesByProject: {
            ...state.filesByProject,
            [projectId]: files.map((f) => f.id === id ? { ...f, include_mode: mode } : f),
          },
        };
      });
    } catch (e) {
      console.error('Failed to update file mode:', e);
      throw e;
    }
  },

  updateProjectFileSummary: async (projectId, id, summary) => {
    try {
      await invoke('update_project_file_summary', { id, summary });
      set((state) => {
        const files = state.filesByProject[projectId] || [];
        return {
          filesByProject: {
            ...state.filesByProject,
            [projectId]: files.map((f) => f.id === id ? { ...f, summary } : f),
          },
        };
      });
    } catch (e) {
      console.error('Failed to update file summary:', e);
      throw e;
    }
  },
}));
