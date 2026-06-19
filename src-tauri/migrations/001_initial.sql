-- Verdant Initial Schema Migration v1
-- All data stored locally in SQLite

-- Provider configurations
CREATE TABLE IF NOT EXISTS providers (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL DEFAULT 'ollama',
    endpoint    TEXT NOT NULL DEFAULT 'http://localhost:11434',
    api_key     TEXT,
    is_default  INTEGER DEFAULT 0,
    config_json TEXT DEFAULT '{}',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

-- Chat sessions
CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL DEFAULT 'Untitled',
    tag         TEXT,
    model_id    TEXT,
    provider_id TEXT REFERENCES providers(id),
    is_pinned   INTEGER DEFAULT 0,
    preview     TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

-- Chat messages
CREATE TABLE IF NOT EXISTS messages (
    id          TEXT PRIMARY KEY,
    session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role        TEXT NOT NULL,
    content     TEXT NOT NULL,
    model_id    TEXT,
    created_at  TEXT NOT NULL,
    sort_order  INTEGER NOT NULL
);

-- User memories
CREATE TABLE IF NOT EXISTS memories (
    id              TEXT PRIMARY KEY,
    content         TEXT NOT NULL,
    category        TEXT NOT NULL DEFAULT 'CONTEXT',
    source_session  TEXT REFERENCES sessions(id),
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

-- Knowledge graph nodes
CREATE TABLE IF NOT EXISTS graph_nodes (
    id          TEXT PRIMARY KEY,
    label       TEXT NOT NULL,
    category    TEXT NOT NULL DEFAULT 'CONCEPT',
    color       TEXT,
    x           REAL DEFAULT 0,
    y           REAL DEFAULT 0,
    metadata    TEXT DEFAULT '{}',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

-- Knowledge graph edges
CREATE TABLE IF NOT EXISTS graph_edges (
    id          TEXT PRIMARY KEY,
    source_id   TEXT NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
    target_id   TEXT NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
    label       TEXT,
    metadata    TEXT DEFAULT '{}',
    created_at  TEXT NOT NULL
);

-- Tracks graph extraction status per session
CREATE TABLE IF NOT EXISTS graph_extractions (
    id           TEXT PRIMARY KEY,
    session_id   TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    model_id     TEXT,
    status       TEXT NOT NULL DEFAULT 'pending',
    extracted_at TEXT,
    node_count   INTEGER DEFAULT 0,
    edge_count   INTEGER DEFAULT 0
);

-- Application settings key-value store
CREATE TABLE IF NOT EXISTS settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

-- Insert default settings
INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
    ('ollama_host', 'http://localhost:11434', datetime('now')),
    ('auto_remember', 'true', datetime('now')),
    ('show_graph_panel', 'true', datetime('now')),
    ('anonymous_telemetry', 'false', datetime('now')),
    ('theme', 'paper-light', datetime('now')),
    ('extraction_model', '', datetime('now'));

-- Insert default Ollama provider
INSERT OR IGNORE INTO providers (id, name, type, endpoint, is_default, created_at, updated_at) VALUES
    ('provider-ollama-default', 'Ollama', 'ollama', 'http://localhost:11434', 1, datetime('now'), datetime('now'));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_sort_order ON messages(session_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_graph_edges_source ON graph_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_target ON graph_edges(target_id);
