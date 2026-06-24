use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::Database;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Session {
    pub id: String,
    pub title: String,
    pub tag: Option<String>,
    pub model_id: Option<String>,
    pub provider_id: Option<String>,
    pub is_pinned: bool,
    pub preview: Option<String>,
    pub project_id: Option<String>,
    pub summary: Option<String>,
    pub summary_updated_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateSessionInput {
    pub title: Option<String>,
    pub model_id: Option<String>,
    pub provider_id: Option<String>,
    pub project_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateSessionInput {
    pub title: Option<String>,
    pub tag: Option<String>,
    pub model_id: Option<String>,
    pub is_pinned: Option<bool>,
    pub preview: Option<String>,
    pub project_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ForkSessionInput {
    pub session_id: String,
    pub message_ids: Vec<String>,
}

// Shared column list + row mapper so every SELECT stays in sync with the struct.
const SESSION_COLS: &str = "id, title, tag, model_id, provider_id, is_pinned, preview, project_id, summary, summary_updated_at, created_at, updated_at";

fn map_session(row: &rusqlite::Row) -> rusqlite::Result<Session> {
    Ok(Session {
        id: row.get(0)?,
        title: row.get(1)?,
        tag: row.get(2)?,
        model_id: row.get(3)?,
        provider_id: row.get(4)?,
        is_pinned: row.get::<_, i32>(5)? != 0,
        preview: row.get(6)?,
        project_id: row.get(7)?,
        summary: row.get(8)?,
        summary_updated_at: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
    })
}

#[tauri::command]
pub fn get_sessions(db: State<Database>) -> Result<Vec<Session>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let sql = format!(
        "SELECT {SESSION_COLS} FROM sessions ORDER BY is_pinned DESC, updated_at DESC"
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let sessions = stmt.query_map([], map_session).map_err(|e| e.to_string())?;
    sessions.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_project_sessions(project_id: String, db: State<Database>) -> Result<Vec<Session>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let sql = format!(
        "SELECT {SESSION_COLS} FROM sessions WHERE project_id = ?1 ORDER BY is_pinned DESC, updated_at DESC"
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let sessions = stmt.query_map(params![project_id], map_session).map_err(|e| e.to_string())?;
    sessions.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_session(id: String, db: State<Database>) -> Result<Option<Session>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let sql = format!("SELECT {SESSION_COLS} FROM sessions WHERE id = ?1");
    let result = conn.query_row(&sql, params![id], map_session);
    match result {
        Ok(s) => Ok(Some(s)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn create_session(input: CreateSessionInput, db: State<Database>) -> Result<Session, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let title = input.title.unwrap_or_else(|| "Untitled".to_string());

    conn.execute(
        "INSERT INTO sessions (id, title, model_id, provider_id, project_id, is_pinned, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, ?7)",
        params![id, title, input.model_id, input.provider_id, input.project_id, now, now],
    ).map_err(|e| e.to_string())?;

    Ok(Session {
        id,
        title,
        tag: None,
        model_id: input.model_id,
        provider_id: input.provider_id,
        is_pinned: false,
        preview: None,
        project_id: input.project_id,
        summary: None,
        summary_updated_at: None,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub fn update_session(id: String, input: UpdateSessionInput, db: State<Database>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    if let Some(title) = input.title {
        conn.execute("UPDATE sessions SET title = ?1, updated_at = ?2 WHERE id = ?3",
            params![title, now, id]).map_err(|e| e.to_string())?;
    }
    if let Some(tag) = input.tag {
        conn.execute("UPDATE sessions SET tag = ?1, updated_at = ?2 WHERE id = ?3",
            params![tag, now, id]).map_err(|e| e.to_string())?;
    }
    if let Some(model_id) = input.model_id {
        conn.execute("UPDATE sessions SET model_id = ?1, updated_at = ?2 WHERE id = ?3",
            params![model_id, now, id]).map_err(|e| e.to_string())?;
    }
    if let Some(is_pinned) = input.is_pinned {
        conn.execute("UPDATE sessions SET is_pinned = ?1, updated_at = ?2 WHERE id = ?3",
            params![is_pinned as i32, now, id]).map_err(|e| e.to_string())?;
    }
    if let Some(preview) = input.preview {
        conn.execute("UPDATE sessions SET preview = ?1, updated_at = ?2 WHERE id = ?3",
            params![preview, now, id]).map_err(|e| e.to_string())?;
    }
    if let Some(project_id) = input.project_id {
        conn.execute("UPDATE sessions SET project_id = ?1, updated_at = ?2 WHERE id = ?3",
            params![project_id, now, id]).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// Persist a session's cached summary. summary_updated_at stamps the cache so
// callers can detect staleness vs the session's own updated_at.
#[tauri::command]
pub fn set_session_summary(id: String, summary: String, db: State<Database>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE sessions SET summary = ?1, summary_updated_at = ?2 WHERE id = ?3",
        params![summary, now, id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_session(id: String, db: State<Database>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM sessions WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn search_sessions(query: String, db: State<Database>) -> Result<Vec<Session>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let pattern = format!("%{}%", query);
    let sql = format!(
        "SELECT {SESSION_COLS} FROM sessions WHERE title LIKE ?1 OR preview LIKE ?1 ORDER BY updated_at DESC LIMIT 20"
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let sessions = stmt.query_map(params![pattern], map_session).map_err(|e| e.to_string())?;
    sessions.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fork_session(input: ForkSessionInput, db: State<Database>) -> Result<Session, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    
    // 1. Get original session
    let sql = format!("SELECT {SESSION_COLS} FROM sessions WHERE id = ?1");
    let orig_session: Session = conn.query_row(&sql, params![input.session_id], map_session)
        .map_err(|e| format!("Failed to find original session: {}", e))?;

    // 2. Create new session
    let new_session_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let new_title = format!("{} (Branch)", orig_session.title);

    conn.execute(
        "INSERT INTO sessions (id, title, tag, model_id, provider_id, project_id, is_pinned, preview, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, ?8, ?9)",
        params![
            new_session_id, new_title, orig_session.tag, orig_session.model_id, orig_session.provider_id, 
            orig_session.project_id, orig_session.preview, now, now
        ],
    ).map_err(|e| e.to_string())?;

    // 3. Clone messages
    // The frontend guarantees message_ids is in topological order (root to leaf).
    // We map old_id -> new_id to rewrite parent_ids.
    let mut id_map = std::collections::HashMap::new();

    let mut select_stmt = conn.prepare(
        "SELECT role, content, model_id, created_at, sort_order, parent_id FROM messages WHERE id = ?1"
    ).map_err(|e| e.to_string())?;

    let mut insert_stmt = conn.prepare(
        "INSERT INTO messages (id, session_id, role, content, model_id, created_at, sort_order, parent_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
    ).map_err(|e| e.to_string())?;

    for old_id in input.message_ids {
        let mut rows = select_stmt.query(params![old_id]).map_err(|e| e.to_string())?;
        if let Some(row) = rows.next().map_err(|e| e.to_string())? {
            let new_msg_id = uuid::Uuid::new_v4().to_string();
            let role: String = row.get(0).unwrap();
            let content: String = row.get(1).unwrap();
            let model_id: Option<String> = row.get(2).unwrap();
            let created_at: String = row.get(3).unwrap();
            let sort_order: i64 = row.get(4).unwrap();
            let old_parent_id: Option<String> = row.get(5).unwrap();

            let new_parent_id = old_parent_id.and_then(|p| id_map.get(&p).cloned());

            insert_stmt.execute(params![
                new_msg_id, new_session_id, role, content, model_id, created_at, sort_order, new_parent_id
            ]).map_err(|e| e.to_string())?;

            id_map.insert(old_id, new_msg_id);
        }
    }

    Ok(Session {
        id: new_session_id,
        title: new_title,
        tag: orig_session.tag,
        model_id: orig_session.model_id,
        provider_id: orig_session.provider_id,
        is_pinned: false,
        preview: orig_session.preview,
        project_id: orig_session.project_id,
        summary: None,
        summary_updated_at: None,
        created_at: now.clone(),
        updated_at: now,
    })
}
