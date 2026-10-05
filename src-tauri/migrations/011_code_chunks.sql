-- Verdant Schema Migration v11 — Code Chunks & Vector Store for RAG
-- Stores text/code chunks with vector embeddings and full-text search capability.

CREATE TABLE IF NOT EXISTS code_chunks (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    file_path   TEXT NOT NULL,
    chunk_text  TEXT NOT NULL,
    start_line  INTEGER NOT NULL,
    end_line    INTEGER NOT NULL,
    embedding   BLOB, -- Float32 vector stored as raw byte array
    created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_code_chunks_project ON code_chunks(project_id);
CREATE INDEX IF NOT EXISTS idx_code_chunks_file ON code_chunks(project_id, file_path);
