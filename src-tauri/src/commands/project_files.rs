use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::Database;

// Knowledge-base files. Text is extracted on the frontend and stored here as
// plain text for context injection. ponytail: text only — no PDF/media/embeddings yet.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProjectFile {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub ext: Option<String>,
    pub size: i64,
    pub object_id: String,
    pub include_mode: String,
    pub summary: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateProjectFileInput {
    pub project_id: String,
    pub name: String,
    pub ext: Option<String>,
    pub size: Option<i64>,
    pub object_id: String,
    pub include_mode: Option<String>,
}

#[tauri::command]
pub fn get_project_files(project_id: String, db: State<Database>) -> Result<Vec<ProjectFile>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, project_id, name, ext, size, object_id, include_mode, summary, created_at
         FROM project_files WHERE project_id = ?1 ORDER BY created_at DESC"
    ).map_err(|e| e.to_string())?;

    let files = stmt.query_map(params![project_id], |row| {
        Ok(ProjectFile {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            ext: row.get(3)?,
            size: row.get(4)?,
            object_id: row.get(5)?,
            include_mode: row.get(6)?,
            summary: row.get(7)?,
            created_at: row.get(8)?,
        })
    }).map_err(|e| e.to_string())?;

    files.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_project_file(input: CreateProjectFileInput, db: State<Database>) -> Result<ProjectFile, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let size = input.size.unwrap_or(0);
    let include_mode = input.include_mode.unwrap_or_else(|| "inline".to_string());

    conn.execute(
        "INSERT INTO project_files (id, project_id, name, ext, size, object_id, include_mode, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![id, input.project_id, input.name, input.ext, size, input.object_id, include_mode, now],
    ).map_err(|e| e.to_string())?;

    Ok(ProjectFile {
        id,
        project_id: input.project_id,
        name: input.name,
        ext: input.ext,
        size,
        object_id: input.object_id,
        include_mode,
        summary: None,
        created_at: now,
    })
}

#[tauri::command]
pub fn delete_project_file(id: String, db: State<Database>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM project_files WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_project_file_mode(id: String, mode: String, db: State<Database>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE project_files SET include_mode = ?1 WHERE id = ?2",
        params![mode, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_project_file_summary(id: String, summary: String, db: State<Database>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE project_files SET summary = ?1 WHERE id = ?2",
        params![summary, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
