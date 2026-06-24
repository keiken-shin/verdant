use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::Database;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Persona {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub prompt: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreatePersonaInput {
    pub name: String,
    pub description: Option<String>,
    pub prompt: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdatePersonaInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub prompt: Option<String>,
}

const PERSONA_COLS: &str = "id, name, description, prompt, created_at, updated_at";

fn map_persona(row: &rusqlite::Row) -> rusqlite::Result<Persona> {
    Ok(Persona {
        id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2)?,
        prompt: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    })
}

#[tauri::command]
pub fn get_personas(db: State<Database>) -> Result<Vec<Persona>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let sql = format!("SELECT {PERSONA_COLS} FROM personas ORDER BY name ASC");
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let personas = stmt.query_map([], map_persona).map_err(|e| e.to_string())?;
    personas.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_persona(input: CreatePersonaInput, db: State<Database>) -> Result<Persona, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO personas (id, name, description, prompt, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, input.name, input.description, input.prompt, now, now],
    ).map_err(|e| e.to_string())?;

    Ok(Persona {
        id,
        name: input.name,
        description: input.description,
        prompt: input.prompt,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub fn update_persona(id: String, input: UpdatePersonaInput, db: State<Database>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    if let Some(name) = input.name {
        conn.execute("UPDATE personas SET name = ?1, updated_at = ?2 WHERE id = ?3",
            params![name, now, id]).map_err(|e| e.to_string())?;
    }
    if let Some(description) = input.description {
        conn.execute("UPDATE personas SET description = ?1, updated_at = ?2 WHERE id = ?3",
            params![description, now, id]).map_err(|e| e.to_string())?;
    }
    if let Some(prompt) = input.prompt {
        conn.execute("UPDATE personas SET prompt = ?1, updated_at = ?2 WHERE id = ?3",
            params![prompt, now, id]).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn delete_persona(id: String, db: State<Database>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    
    // Detach from projects
    conn.execute("UPDATE projects SET persona_id = NULL WHERE persona_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
        
    conn.execute("DELETE FROM personas WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
