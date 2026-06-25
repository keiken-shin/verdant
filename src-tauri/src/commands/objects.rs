use tauri::{AppHandle, Manager};
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;
use base64::{engine::general_purpose, Engine as _};

fn get_objects_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let objects_dir = app_dir.join("objects");
    if !objects_dir.exists() {
        fs::create_dir_all(&objects_dir).map_err(|e| e.to_string())?;
    }
    Ok(objects_dir)
}

#[tauri::command]
pub fn store_object(data: Vec<u8>, app: AppHandle) -> Result<String, String> {
    let objects_dir = get_objects_dir(&app)?;
    let id = Uuid::new_v4().to_string();
    let file_path = objects_dir.join(&id);
    
    fs::write(file_path, data).map_err(|e| e.to_string())?;
    
    Ok(id)
}

#[tauri::command]
pub fn read_object_base64(id: String, app: AppHandle) -> Result<String, String> {
    let objects_dir = get_objects_dir(&app)?;
    let file_path = objects_dir.join(&id);
    
    let data = fs::read(file_path).map_err(|e| e.to_string())?;
    let base64 = general_purpose::STANDARD.encode(data);
    
    Ok(base64)
}

#[tauri::command]
pub fn read_object_text(id: String, app: AppHandle) -> Result<String, String> {
    let objects_dir = get_objects_dir(&app)?;
    let file_path = objects_dir.join(&id);
    
    let text = fs::read_to_string(file_path).map_err(|e| e.to_string())?;
    
    Ok(text)
}

#[tauri::command]
pub fn delete_object(id: String, app: AppHandle) -> Result<(), String> {
    let objects_dir = get_objects_dir(&app)?;
    let file_path = objects_dir.join(&id);
    
    if file_path.exists() {
        fs::remove_file(file_path).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}
