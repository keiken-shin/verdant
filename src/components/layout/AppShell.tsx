import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { SearchModal } from '@/components/ui/SearchModal';
import { KnowledgeGraphPanel } from '@/components/graph/KnowledgeGraphPanel';
import { useUiStore } from '@/stores/uiStore';
import { useLocation } from 'react-router-dom';

export function AppShell() {
  const { graphPanelOpen } = useUiStore();
  const location = useLocation();

  // Only show the graph panel when on a chat route
  const isChatRoute = location.pathname === '/' || location.pathname.startsWith('/chat');
  const showPanel = graphPanelOpen && isChatRoute;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--color-wollama-bg)]">
      {/* Left: Sidebar */}
      <Sidebar />

      {/* Center: Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>

      {/* Right: Knowledge Graph Panel (chat only) */}
      {showPanel && (
        <KnowledgeGraphPanel />
      )}

      {/* Global: Search Modal */}
      <SearchModal />
    </div>
  );
}
