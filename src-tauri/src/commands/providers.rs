use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::Database;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Provider {
    pub id: String,
    pub name: String,
    pub r#type: String,
    pub endpoint: String,
    pub api_key: Option<String>,
    pub is_default: bool,
    pub config_json: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateProviderInput {
    pub name: Option<String>,
    pub endpoint: Option<String>,
    pub api_key: Option<String>,
    pub is_default: Option<bool>,
}

#[tauri::command]
pub fn get_providers(db: State<Database>) -> Result<Vec<Provider>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, name, type, endpoint, api_key, is_default, config_json, created_at, updated_at
         FROM providers ORDER BY is_default DESC, name ASC"
    ).map_err(|e| e.to_string())?;

    let providers = stmt.query_map([], |row| {
        Ok(Provider {
            id: row.get(0)?,
            name: row.get(1)?,
            r#type: row.get(2)?,
            endpoint: row.get(3)?,
            api_key: row.get(4)?,
            is_default: row.get::<_, i32>(5)? != 0,
            config_json: row.get(6)?,
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
        })
    }).map_err(|e| e.to_string())?;

    providers.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_provider(id: String, input: UpdateProviderInput, db: State<Database>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    if let Some(endpoint) = input.endpoint {
        conn.execute("UPDATE providers SET endpoint = ?1, updated_at = ?2 WHERE id = ?3",
            params![endpoint, now, id]).map_err(|e| e.to_string())?;
    }
    if let Some(api_key) = input.api_key {
        conn.execute("UPDATE providers SET api_key = ?1, updated_at = ?2 WHERE id = ?3",
            params![api_key, now, id]).map_err(|e| e.to_string())?;
    }
    if let Some(name) = input.name {
        conn.execute("UPDATE providers SET name = ?1, updated_at = ?2 WHERE id = ?3",
            params![name, now, id]).map_err(|e| e.to_string())?;
    }
    Ok(())
}
