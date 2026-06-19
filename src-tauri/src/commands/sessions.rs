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
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateSessionInput {
    pub title: Option<String>,
    pub model_id: Option<String>,
    pub provider_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateSessionInput {
    pub title: Option<String>,
    pub tag: Option<String>,
    pub model_id: Option<String>,
    pub is_pinned: Option<bool>,
    pub preview: Option<String>,
}

#[tauri::command]
pub fn get_sessions(db: State<Database>) -> Result<Vec<Session>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, title, tag, model_id, provider_id, is_pinned, preview, created_at, updated_at
         FROM sessions ORDER BY is_pinned DESC, updated_at DESC"
    ).map_err(|e| e.to_string())?;

    let sessions = stmt.query_map([], |row| {
        Ok(Session {
            id: row.get(0)?,
            title: row.get(1)?,
            tag: row.get(2)?,
            model_id: row.get(3)?,
            provider_id: row.get(4)?,
            is_pinned: row.get::<_, i32>(5)? != 0,
            preview: row.get(6)?,
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
        })
    }).map_err(|e| e.to_string())?;

    sessions.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_session(id: String, db: State<Database>) -> Result<Option<Session>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let result = conn.query_row(
        "SELECT id, title, tag, model_id, provider_id, is_pinned, preview, created_at, updated_at
         FROM sessions WHERE id = ?1",
        params![id],
        |row| Ok(Session {
            id: row.get(0)?,
            title: row.get(1)?,
            tag: row.get(2)?,
            model_id: row.get(3)?,
            provider_id: row.get(4)?,
            is_pinned: row.get::<_, i32>(5)? != 0,
            preview: row.get(6)?,
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
        }),
    );
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
        "INSERT INTO sessions (id, title, model_id, provider_id, is_pinned, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6)",
        params![id, title, input.model_id, input.provider_id, now, now],
    ).map_err(|e| e.to_string())?;

    Ok(Session {
        id,
        title,
        tag: None,
        model_id: input.model_id,
        provider_id: input.provider_id,
        is_pinned: false,
        preview: None,
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
    let mut stmt = conn.prepare(
        "SELECT id, title, tag, model_id, provider_id, is_pinned, preview, created_at, updated_at
         FROM sessions WHERE title LIKE ?1 OR preview LIKE ?1 ORDER BY updated_at DESC LIMIT 20"
    ).map_err(|e| e.to_string())?;

    let sessions = stmt.query_map(params![pattern], |row| {
        Ok(Session {
            id: row.get(0)?,
            title: row.get(1)?,
            tag: row.get(2)?,
            model_id: row.get(3)?,
            provider_id: row.get(4)?,
            is_pinned: row.get::<_, i32>(5)? != 0,
            preview: row.get(6)?,
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
        })
    }).map_err(|e| e.to_string())?;

    sessions.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}
