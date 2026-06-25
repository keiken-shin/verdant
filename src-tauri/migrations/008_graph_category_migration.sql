-- Migration 008: Remap legacy graph node categories to the universal taxonomy
-- and extend the metadata field to support source_session_id and relevance.

-- Map old domain-specific categories to new universal ones:
--   CONCEPT  → TOPIC     (abstract ideas → subjects/themes)
--   READING  → ENTITY    (books/authors → named things)
--   CORE     → INSIGHT   (foundational beliefs → conclusions/learnings)
--   IDEA     → INSIGHT   (specific insights → same category)
--   ESSAY    → TOPIC     (writing projects → subjects/themes)
--   RESEARCH → TOPIC     (research topics → subjects/themes)
--   DESIGN   → DECISION  (design decisions → choices made)

UPDATE graph_nodes SET category = 'TOPIC'    WHERE category = 'CONCEPT';
UPDATE graph_nodes SET category = 'ENTITY'   WHERE category = 'READING';
UPDATE graph_nodes SET category = 'INSIGHT'  WHERE category = 'CORE';
UPDATE graph_nodes SET category = 'INSIGHT'  WHERE category = 'IDEA';
UPDATE graph_nodes SET category = 'TOPIC'    WHERE category = 'ESSAY';
UPDATE graph_nodes SET category = 'TOPIC'    WHERE category = 'RESEARCH';
UPDATE graph_nodes SET category = 'DECISION' WHERE category = 'DESIGN';
