import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useProjectStore } from '@/stores/projectStore';
import { useSessionStore } from '@/stores/sessionStore';
import { ProjectWorkspaceHeader, TABS, type Tab } from '@/components/project-workspace/ProjectWorkspaceHeader';
import { ProjectChatTab } from '@/components/project-workspace/ProjectChatTab';
import { ProjectFilesTab } from '@/components/project-workspace/ProjectFilesTab';
import { ProjectGraphTab } from '@/components/project-workspace/ProjectGraphTab';
import { ProjectTimelineTab } from '@/components/project-workspace/ProjectTimelineTab';

export function ProjectWorkspacePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { projects, fetchProjects, touchProject, filesByProject, fetchProjectFiles } = useProjectStore();
  const { sessions } = useSessionStore();

  const [tab, setTab] = useState<Tab>('Chat');

  const project = projects.find((p) => p.id === projectId);
  const projectSessions = useMemo(
    () => sessions.filter((s) => s.project_id === projectId),
    [sessions, projectId]
  );
  const files = projectId ? (filesByProject[projectId] || []) : [];

  // Load project list (deep-link), files, and mark as recently opened.
  useEffect(() => {
    if (!projects.length) fetchProjects();
  }, []);

  useEffect(() => {
    if (projectId) {
      touchProject(projectId);
      fetchProjectFiles(projectId);
      useSessionStore.getState().fetchProjectSessions(projectId);
    }
  }, [projectId]);

  if (!project) {
    return <div className="px-12 py-12 text-sm text-zinc-400">Project not found.</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <ProjectWorkspaceHeader
        project={project}
        tab={tab}
        setTab={setTab}
        filesCount={files.length}
      />

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'Chat' && (
          <ProjectChatTab projectId={project.id} projectSessions={projectSessions} />
        )}
        {tab === 'Files' && (
          <ProjectFilesTab project={project} files={files} />
        )}
        {tab === 'Graph' && (
          <ProjectGraphTab projectId={project.id} />
        )}
        {tab === 'Timeline' && (
          <ProjectTimelineTab projectSessions={projectSessions} />
        )}
      </div>
    </div>
  );
}
