-- Verdant Schema Migration v5 — Object Store & Attachments

-- Add attachments JSON array to messages
ALTER TABLE messages ADD COLUMN attachments TEXT;

-- Add object_id to project_files to point to the universal object store
ALTER TABLE project_files ADD COLUMN object_id TEXT;

-- Note: We do not DROP COLUMN content_text from project_files because SQLite's
-- ALTER TABLE DROP COLUMN has mixed support across older versions. 
-- The column will just be ignored by the application layer.
