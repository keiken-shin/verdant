use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::Database;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Memory {
    pub id: String,
    pub content: String,
    pub category: String,
    pub source_session: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateMemoryInput {
    pub content: String,
    pub category: Option<String>,
    pub source_session: Option<String>,
}

#[tauri::command]
pub fn get_memories(db: State<Database>) -> Result<Vec<Memory>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, content, category, source_session, created_at, updated_at
         FROM memories ORDER BY created_at DESC"
    ).map_err(|e| e.to_string())?;

    let memories = stmt.query_map([], |row| {
        Ok(Memory {
            id: row.get(0)?,
            content: row.get(1)?,
            category: row.get(2)?,
            source_session: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?;

    memories.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_memory(input: CreateMemoryInput, db: State<Database>) -> Result<Memory, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let category = input.category.unwrap_or_else(|| "CONTEXT".to_string());

    conn.execute(
        "INSERT INTO memories (id, content, category, source_session, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, input.content, category, input.source_session, now, now],
    ).map_err(|e| e.to_string())?;

    Ok(Memory {
        id,
        content: input.content,
        category,
        source_session: input.source_session,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub fn update_memory(id: String, content: String, category: Option<String>, db: State<Database>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    if let Some(cat) = category {
        conn.execute(
            "UPDATE memories SET content = ?1, category = ?2, updated_at = ?3 WHERE id = ?4",
            params![content, cat, now, id],
        ).map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "UPDATE memories SET content = ?1, updated_at = ?2 WHERE id = ?3",
            params![content, now, id],
        ).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn delete_memory(id: String, db: State<Database>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM memories WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn search_memories(query: String, db: State<Database>) -> Result<Vec<Memory>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let pattern = format!("%{}%", query);
    let mut stmt = conn.prepare(
        "SELECT id, content, category, source_session, created_at, updated_at
         FROM memories WHERE content LIKE ?1 ORDER BY created_at DESC LIMIT 20"
    ).map_err(|e| e.to_string())?;

    let memories = stmt.query_map(params![pattern], |row| {
        Ok(Memory {
            id: row.get(0)?,
            content: row.get(1)?,
            category: row.get(2)?,
            source_session: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?;

    memories.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}
