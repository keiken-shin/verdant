-- Verdant Schema Migration v9 — Tool Calls

-- Add tool_calls array (JSON) and tool_call_id to messages
ALTER TABLE messages ADD COLUMN tool_calls TEXT;
ALTER TABLE messages ADD COLUMN tool_call_id TEXT;
