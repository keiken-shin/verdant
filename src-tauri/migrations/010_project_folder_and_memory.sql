-- Verdant Schema Migration v10 — Project Folder, Memory Isolation, and Dual-Layer Graph
-- Enables local directory linking for projects, scopes memories to projects with global opt-in,
-- and tags graph nodes/edges for dual-layer code vs. conversation separation.

-- 1. Projects: link to local filesystem directory & toggle global memory inheritance
ALTER TABLE projects ADD COLUMN folder_path TEXT;
ALTER TABLE projects ADD COLUMN allow_global_memories INTEGER DEFAULT 0;

-- 2. Memories: scope memories to a project (nullable = global memory)
ALTER TABLE memories ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project_id);

-- 3. Knowledge Graph: dual-layer support
-- domain: 'conversation' (decisions, topics, insights) vs 'code' (files, functions, classes)
ALTER TABLE graph_nodes ADD COLUMN domain TEXT DEFAULT 'conversation';
CREATE INDEX IF NOT EXISTS idx_graph_nodes_domain ON graph_nodes(domain);

-- edge_type: 'conceptual' (chat relations), 'structural' (AST calls, imports, defines), or 'bridge' (affects, implements)
ALTER TABLE graph_edges ADD COLUMN edge_type TEXT DEFAULT 'conceptual';
CREATE INDEX IF NOT EXISTS idx_graph_edges_edge_type ON graph_edges(edge_type);
