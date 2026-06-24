use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::Database;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub instructions: Option<String>,
    pub color: Option<String>,
    pub is_pinned: bool,
    pub last_opened_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateProjectInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub instructions: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateProjectInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub instructions: Option<String>,
    pub color: Option<String>,
    pub is_pinned: Option<bool>,
}

const PROJECT_COLS: &str = "id, name, description, instructions, color, is_pinned, last_opened_at, created_at, updated_at";

fn map_project(row: &rusqlite::Row) -> rusqlite::Result<Project> {
    Ok(Project {
        id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2)?,
        instructions: row.get(3)?,
        color: row.get(4)?,
        is_pinned: row.get::<_, i32>(5)? != 0,
        last_opened_at: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

#[tauri::command]
pub fn get_projects(db: State<Database>) -> Result<Vec<Project>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let sql = format!(
        "SELECT {PROJECT_COLS} FROM projects
         ORDER BY is_pinned DESC, COALESCE(last_opened_at, updated_at) DESC"
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let projects = stmt.query_map([], map_project).map_err(|e| e.to_string())?;
    projects.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_project(id: String, db: State<Database>) -> Result<Option<Project>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let sql = format!("SELECT {PROJECT_COLS} FROM projects WHERE id = ?1");
    match conn.query_row(&sql, params![id], map_project) {
        Ok(p) => Ok(Some(p)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn create_project(input: CreateProjectInput, db: State<Database>) -> Result<Project, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let name = input.name.unwrap_or_else(|| "Untitled Project".to_string());

    conn.execute(
        "INSERT INTO projects (id, name, description, instructions, color, is_pinned, last_opened_at, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, ?7, ?8)",
        params![id, name, input.description, input.instructions, input.color, now, now, now],
    ).map_err(|e| e.to_string())?;

    Ok(Project {
        id,
        name,
        description: input.description,
        instructions: input.instructions,
        color: input.color,
        is_pinned: false,
        last_opened_at: Some(now.clone()),
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub fn update_project(id: String, input: UpdateProjectInput, db: State<Database>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    if let Some(name) = input.name {
        conn.execute("UPDATE projects SET name = ?1, updated_at = ?2 WHERE id = ?3",
            params![name, now, id]).map_err(|e| e.to_string())?;
    }
    if let Some(description) = input.description {
        conn.execute("UPDATE projects SET description = ?1, updated_at = ?2 WHERE id = ?3",
            params![description, now, id]).map_err(|e| e.to_string())?;
    }
    if let Some(instructions) = input.instructions {
        conn.execute("UPDATE projects SET instructions = ?1, updated_at = ?2 WHERE id = ?3",
            params![instructions, now, id]).map_err(|e| e.to_string())?;
    }
    if let Some(color) = input.color {
        conn.execute("UPDATE projects SET color = ?1, updated_at = ?2 WHERE id = ?3",
            params![color, now, id]).map_err(|e| e.to_string())?;
    }
    if let Some(is_pinned) = input.is_pinned {
        conn.execute("UPDATE projects SET is_pinned = ?1, updated_at = ?2 WHERE id = ?3",
            params![is_pinned as i32, now, id]).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// Stamp last_opened_at so the project surfaces in "recents".
#[tauri::command]
pub fn touch_project(id: String, db: State<Database>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute("UPDATE projects SET last_opened_at = ?1 WHERE id = ?2", params![now, id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_project(id: String, db: State<Database>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    // Detach sessions (keep them as loose chats) before removing the project.
    conn.execute("UPDATE sessions SET project_id = NULL WHERE project_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM projects WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn search_projects(query: String, db: State<Database>) -> Result<Vec<Project>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let pattern = format!("%{}%", query);
    let sql = format!(
        "SELECT {PROJECT_COLS} FROM projects
         WHERE name LIKE ?1 OR description LIKE ?1
         ORDER BY is_pinned DESC, updated_at DESC LIMIT 20"
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let projects = stmt.query_map(params![pattern], map_project).map_err(|e| e.to_string())?;
    projects.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}
