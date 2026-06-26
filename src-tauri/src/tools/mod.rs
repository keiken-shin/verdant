pub mod search;

use serde_json::Value;

#[tauri::command]
pub fn execute_tool(name: String, arguments: Value) -> Result<Value, String> {
    match name.as_str() {
        "web_search" => {
            let query = arguments.get("query")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            search::web_search(query)
        },
        _ => Err(format!("Unknown tool: {}", name)),
    }
}
