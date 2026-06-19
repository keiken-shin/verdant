import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ChatPage } from '@/pages/ChatPage';
import { SessionsPage } from '@/pages/SessionsPage';
import { MemoriesPage } from '@/pages/MemoriesPage';
import { ModelsPage } from '@/pages/ModelsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { KnowledgeGraphPage } from '@/pages/KnowledgeGraphPage';
import { useSessionStore } from '@/stores/sessionStore';
import { useMemoryStore } from '@/stores/memoryStore';
import { useGraphStore } from '@/stores/graphStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useProviderStore } from '@/stores/providerStore';

function App() {
  const { fetchSessions } = useSessionStore();
  const { fetchMemories } = useMemoryStore();
  const { fetchGraph } = useGraphStore();
  const { fetchSettings } = useSettingsStore();
  const { fetchProviders } = useProviderStore();

  // Initialize all data on app start
  useEffect(() => {
    const init = async () => {
      await fetchSettings();
      await fetchProviders();
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
          <Route index element={<ChatPage />} />
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
    </BrowserRouter>
  );
}

export default App;
