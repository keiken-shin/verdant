use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::Database;
use crate::commands::sessions::Session;
use crate::commands::memories::Memory;
use crate::commands::graph::{GraphNode, GraphEdge};

// ─── Export Types ──────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportedSession {
    pub session: Session,
    pub messages: Vec<ExportedMessage>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportedMessage {
    pub id: String,
    pub role: String,
    pub content: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportedGraph {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
    pub exported_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportData {
    pub sessions: Option<Vec<ExportedSession>>,
    pub memories: Option<Vec<Memory>>,
    pub graph: Option<ExportedGraph>,
}

// ─── Export Commands ────────────────────────────────────────────────────────

#[tauri::command]
pub fn export_session_json(session_id: String, db: State<Database>) -> Result<String, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let session: Session = conn.query_row(
        "SELECT id, title, tag, model_id, provider_id, is_pinned, preview, created_at, updated_at
         FROM sessions WHERE id = ?1",
        params![session_id],
        |row| Ok(Session {
            id: row.get(0)?, title: row.get(1)?, tag: row.get(2)?,
            model_id: row.get(3)?, provider_id: row.get(4)?,
            is_pinned: row.get::<_, i32>(5)? != 0,
            preview: row.get(6)?, created_at: row.get(7)?, updated_at: row.get(8)?,
        }),
    ).map_err(|e| e.to_string())?;

    let mut msg_stmt = conn.prepare(
        "SELECT id, role, content, created_at FROM messages WHERE session_id = ?1 ORDER BY sort_order ASC"
    ).map_err(|e| e.to_string())?;

    let messages: Vec<ExportedMessage> = msg_stmt.query_map(params![session_id], |row| {
        Ok(ExportedMessage {
            id: row.get(0)?, role: row.get(1)?, content: row.get(2)?, created_at: row.get(3)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    let exported = ExportedSession { session, messages };
    serde_json::to_string_pretty(&exported).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn export_session_markdown(session_id: String, db: State<Database>) -> Result<String, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let (title, model_id): (String, Option<String>) = conn.query_row(
        "SELECT title, model_id FROM sessions WHERE id = ?1",
        params![session_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT role, content, created_at FROM messages WHERE session_id = ?1 ORDER BY sort_order ASC"
    ).map_err(|e| e.to_string())?;

    let mut md = format!("# {}\n\n", title);
    if let Some(m) = model_id {
        md.push_str(&format!("*Model: {}*\n\n---\n\n", m));
    }

    struct Msg { role: String, content: String, created_at: String }
    let messages: Vec<Msg> = stmt.query_map(params![session_id], |row| {
        Ok(Msg { role: row.get(0)?, content: row.get(1)?, created_at: row.get(2)? })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    for msg in messages {
        let label = match msg.role.as_str() {
            "user" => "**You**",
            "assistant" => "**Assistant**",
            "system" => "**System**",
            _ => "**Unknown**",
        };
        md.push_str(&format!("{}\n\n{}\n\n---\n\n", label, msg.content));
    }

    Ok(md)
}

#[tauri::command]
pub fn export_memories_json(db: State<Database>) -> Result<String, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, content, category, source_session, created_at, updated_at FROM memories ORDER BY created_at DESC"
    ).map_err(|e| e.to_string())?;

    let memories: Vec<Memory> = stmt.query_map([], |row| {
        Ok(Memory {
            id: row.get(0)?, content: row.get(1)?, category: row.get(2)?,
            source_session: row.get(3)?, created_at: row.get(4)?, updated_at: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    serde_json::to_string_pretty(&memories).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn export_graph_json(db: State<Database>) -> Result<String, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut node_stmt = conn.prepare(
        "SELECT id, label, category, color, x, y, metadata, created_at, updated_at FROM graph_nodes"
    ).map_err(|e| e.to_string())?;

    let nodes: Vec<GraphNode> = node_stmt.query_map([], |row| {
        Ok(GraphNode {
            id: row.get(0)?, label: row.get(1)?, category: row.get(2)?,
            color: row.get(3)?, x: row.get(4)?, y: row.get(5)?,
            metadata: row.get(6)?, created_at: row.get(7)?, updated_at: row.get(8)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    let mut edge_stmt = conn.prepare(
        "SELECT id, source_id, target_id, label, metadata, created_at FROM graph_edges"
    ).map_err(|e| e.to_string())?;

    let edges: Vec<GraphEdge> = edge_stmt.query_map([], |row| {
        Ok(GraphEdge {
            id: row.get(0)?, source_id: row.get(1)?, target_id: row.get(2)?,
            label: row.get(3)?, metadata: row.get(4)?, created_at: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    let exported = ExportedGraph {
        nodes, edges,
        exported_at: chrono::Utc::now().to_rfc3339(),
    };

    serde_json::to_string_pretty(&exported).map_err(|e| e.to_string())
}
