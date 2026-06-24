-- Verdant Schema Migration v2 — Projects
-- Adds projects as the primary entity. All changes are additive; existing
-- sessions/graph rows keep working with project_id = NULL.

-- Projects: group sessions, carry shared context, own a knowledge graph
CREATE TABLE IF NOT EXISTS projects (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL DEFAULT 'Untitled Project',
    description     TEXT,
    instructions    TEXT,
    color           TEXT,
    is_pinned       INTEGER DEFAULT 0,
    last_opened_at  TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

-- Files fed into a project to act as a knowledge base (extracted plain text)
CREATE TABLE IF NOT EXISTS project_files (
    id            TEXT PRIMARY KEY,
    project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    ext           TEXT,
    size          INTEGER DEFAULT 0,
    content_text  TEXT NOT NULL DEFAULT '',
    created_at    TEXT NOT NULL
);

-- Link sessions to a project (nullable = loose session) + cached summary
ALTER TABLE sessions ADD COLUMN project_id TEXT REFERENCES projects(id);
ALTER TABLE sessions ADD COLUMN summary TEXT;
ALTER TABLE sessions ADD COLUMN summary_updated_at TEXT;

-- Scope graph entities to a project (nullable = global graph)
ALTER TABLE graph_nodes ADD COLUMN project_id TEXT;
ALTER TABLE graph_edges ADD COLUMN project_id TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_recents ON projects(is_pinned DESC, last_opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_files_project ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_project ON graph_nodes(project_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_project ON graph_edges(project_id);
