-- Verdant Schema Migration v6 — Project File Inclusion Mode

-- Add include_mode to project_files to support Selective Inclusion
ALTER TABLE project_files ADD COLUMN include_mode TEXT NOT NULL DEFAULT 'inline';
