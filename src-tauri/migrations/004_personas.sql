-- Verdant Schema Migration v4 — Personas
-- Adds support for AI personas globally and per-project

CREATE TABLE IF NOT EXISTS personas (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    prompt      TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

-- Default Persona
INSERT OR IGNORE INTO personas (id, name, description, prompt, created_at, updated_at) VALUES 
('default-assistant', 'Assistant', 'Standard helpful AI assistant', 'You are a helpful, harmless, and honest AI assistant.', datetime('now'), datetime('now'));

-- Add persona_id to projects
ALTER TABLE projects ADD COLUMN persona_id TEXT REFERENCES personas(id);

-- Set global default persona
INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
    ('default_persona_id', 'default-assistant', datetime('now'));
