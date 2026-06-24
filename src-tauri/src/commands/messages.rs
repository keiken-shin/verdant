use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::Database;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Message {
    pub id: String,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub model_id: Option<String>,
    pub created_at: String,
    pub sort_order: i64,
    pub parent_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateMessageInput {
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub model_id: Option<String>,
    pub parent_id: Option<String>,
}

#[tauri::command]
pub fn get_messages(session_id: String, db: State<Database>) -> Result<Vec<Message>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, session_id, role, content, model_id, created_at, sort_order, parent_id
         FROM messages WHERE session_id = ?1 ORDER BY sort_order ASC"
    ).map_err(|e| e.to_string())?;

    let messages = stmt.query_map(params![session_id], |row| {
        Ok(Message {
            id: row.get(0)?,
            session_id: row.get(1)?,
            role: row.get(2)?,
            content: row.get(3)?,
            model_id: row.get(4)?,
            created_at: row.get(5)?,
            sort_order: row.get(6)?,
            parent_id: row.get(7)?,
        })
    }).map_err(|e| e.to_string())?;

    messages.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_message(input: CreateMessageInput, db: State<Database>) -> Result<Message, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    // Get next sort order
    let sort_order: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM messages WHERE session_id = ?1",
        params![input.session_id],
        |row| row.get(0),
    ).unwrap_or(0);

    conn.execute(
        "INSERT INTO messages (id, session_id, role, content, model_id, created_at, sort_order, parent_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![id, input.session_id, input.role, input.content, input.model_id, now, sort_order, input.parent_id],
    ).map_err(|e| e.to_string())?;

    // Update session preview and updated_at
    if input.role == "assistant" {
        let preview: String = input.content.chars().take(100).collect();
        conn.execute(
            "UPDATE sessions SET preview = ?1, updated_at = ?2 WHERE id = ?3",
            params![preview, now, input.session_id],
        ).map_err(|e| e.to_string())?;
    }

    Ok(Message {
        id,
        session_id: input.session_id,
        role: input.role,
        content: input.content,
        model_id: input.model_id,
        created_at: now,
        sort_order,
        parent_id: input.parent_id,
    })
}

#[tauri::command]
pub fn update_message(id: String, content: String, db: State<Database>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE messages SET content = ?1 WHERE id = ?2",
        params![content, id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_message(id: String, db: State<Database>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM messages WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_messages_from(session_id: String, from_sort_order: i64, db: State<Database>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM messages WHERE session_id = ?1 AND sort_order >= ?2",
        params![session_id, from_sort_order],
    ).map_err(|e| e.to_string())?;
    Ok(())
}
