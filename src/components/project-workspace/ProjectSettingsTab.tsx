import React, { useEffect } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { usePersonaStore } from '@/stores/personaStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { Project } from '@/types';

interface ProjectSettingsTabProps {
  project: Project;
}

export function ProjectSettingsTab({ project }: ProjectSettingsTabProps) {
  const { updateProject } = useProjectStore();
  const { personas, fetchPersonas } = usePersonaStore();
  const { settings } = useSettingsStore();

  useEffect(() => {
    if (personas.length === 0) {
      fetchPersonas();
    }
  }, [personas.length, fetchPersonas]);

  const defaultPersona = personas.find(p => p.id === settings.default_persona_id);

  return (
    <div className="p-10 max-w-2xl mx-auto w-full">
      <h2 className="text-xl font-semibold text-zinc-800 mb-6 border-b border-zinc-100 pb-4">Project Settings</h2>
      
      <div className="mb-10">
        <h3 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase mb-4">Personality & Behavior</h3>
        
        <div className="flex items-start justify-between py-3 border-b border-zinc-100 last:border-0">
          <div className="flex-1 pr-8">
            <label htmlFor="project-persona" className="block text-sm font-medium text-zinc-800 mb-0.5">
              Project Persona
            </label>
            <p className="text-sm text-zinc-500 leading-relaxed max-w-md">
              Choose an AI persona for this project. This will override the global default persona.
            </p>
          </div>
          <div className="shrink-0 mt-0.5">
            <select
              id="project-persona"
              value={project.persona_id || ''}
              onChange={(e) => updateProject(project.id, { persona_id: e.target.value })}
              className="px-3 py-1.5 text-sm border border-zinc-200 rounded-lg outline-none focus:border-[var(--color-verdant-primary)] transition-colors text-zinc-700 w-52 bg-white cursor-pointer"
            >
              <option value="">Use Global Default ({defaultPersona?.name || 'Assistant'})</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
    </div>
  );
}
