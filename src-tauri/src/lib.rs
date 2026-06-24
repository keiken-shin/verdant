mod db;
mod commands;

use db::Database;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let app_dir = app.path().app_data_dir().expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_dir).expect("Failed to create app data dir");
            let db_path = app_dir.join("verdant.db");
            let db = Database::new(db_path.to_str().unwrap()).expect("Failed to initialize database");
            app.manage(db);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Sessions
            commands::sessions::get_sessions,
            commands::sessions::get_project_sessions,
            commands::sessions::get_session,
            commands::sessions::create_session,
            commands::sessions::update_session,
            commands::sessions::set_session_summary,
            commands::sessions::delete_session,
            commands::sessions::search_sessions,
            commands::sessions::fork_session,
            // Projects
            commands::projects::get_projects,
            commands::projects::get_project,
            commands::projects::create_project,
            commands::projects::update_project,
            commands::projects::touch_project,
            commands::projects::delete_project,
            commands::projects::search_projects,
            // Personas
            commands::personas::get_personas,
            commands::personas::create_persona,
            commands::personas::update_persona,
            commands::personas::delete_persona,
            // Project files (knowledge base)
            commands::project_files::get_project_files,
            commands::project_files::create_project_file,
            commands::project_files::delete_project_file,
            // Messages
            commands::messages::get_messages,
            commands::messages::create_message,
            commands::messages::update_message,
            commands::messages::delete_message,
            commands::messages::delete_messages_from,
            // Memories
            commands::memories::get_memories,
            commands::memories::create_memory,
            commands::memories::update_memory,
            commands::memories::delete_memory,
            commands::memories::search_memories,
            // Graph
            commands::graph::get_graph_data,
            commands::graph::create_graph_node,
            commands::graph::create_graph_edge,
            commands::graph::update_node_positions,
            commands::graph::delete_graph_node,
            commands::graph::delete_graph_edge,
            commands::graph::record_graph_extraction,
            // Settings
            commands::settings::get_settings,
            commands::settings::get_setting,
            commands::settings::set_setting,
            // Providers
            commands::providers::get_providers,
            commands::providers::update_provider,
            // Export
            commands::export::export_session_json,
            commands::export::export_session_markdown,
            commands::export::export_memories_json,
            commands::export::export_graph_json,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
