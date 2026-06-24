-- Add parent_id to support tree-based conversation history for variants and regeneration
ALTER TABLE messages ADD COLUMN parent_id TEXT;
