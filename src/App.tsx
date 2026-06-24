import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ChatPage } from '@/pages/ChatPage';
import { SessionsPage } from '@/pages/SessionsPage';
import { MemoriesPage } from '@/pages/MemoriesPage';
import { ModelsPage } from '@/pages/ModelsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { KnowledgeGraphPage } from '@/pages/KnowledgeGraphPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { ProjectWorkspacePage } from '@/pages/ProjectWorkspacePage';
import { useSessionStore } from '@/stores/sessionStore';
import { useMemoryStore } from '@/stores/memoryStore';
import { useGraphStore } from '@/stores/graphStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useProviderStore } from '@/stores/providerStore';
import { useProjectStore } from '@/stores/projectStore';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

function App() {
  const { fetchSessions } = useSessionStore();
  const { fetchMemories } = useMemoryStore();
  const { fetchGraph } = useGraphStore();
  const { fetchSettings } = useSettingsStore();
  const { fetchProviders } = useProviderStore();
  const { fetchProjects } = useProjectStore();

  // Initialize all data on app start
  useEffect(() => {
    const init = async () => {
      await fetchSettings();
      await fetchProviders();
      await fetchProjects();
      await fetchSessions();
      await fetchMemories();
      await fetchGraph();
    };
    init().catch(console.error);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<ProjectsPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId" element={<ProjectWorkspacePage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/:sessionId" element={<ChatPage />} />
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/memories" element={<MemoriesPage />} />
          <Route path="/models" element={<ModelsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/knowledge-graph" element={<KnowledgeGraphPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <ConfirmModal />
    </BrowserRouter>
  );
}

export default App;
