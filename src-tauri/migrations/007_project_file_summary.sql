-- Verdant Schema Migration v7 — Project File Summary

-- Add summary to project_files to support Phase 2 summarization
ALTER TABLE project_files ADD COLUMN summary TEXT;
