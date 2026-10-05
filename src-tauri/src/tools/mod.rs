pub mod search;

use std::fs;
use std::path::PathBuf;
use serde_json::{json, Value};

const IGNORED_NAMES: &[&str] = &[
    "node_modules",
    ".git",
    "target",
    "dist",
    "build",
    ".next",
    ".cache",
    ".vscode",
    ".idea",
    "venv",
    ".venv",
    "__pycache__",
    "package-lock.json",
    "Cargo.lock",
    "pnpm-lock.yaml",
    "yarn.lock",
];

const BINARY_EXTENSIONS: &[&str] = &[
    "png", "jpg", "jpeg", "gif", "ico", "webp", "svg", "bmp",
    "mp4", "mp3", "wav", "ogg", "avi", "mov", "webm",
    "zip", "tar", "gz", "7z", "rar",
    "exe", "dll", "so", "dylib", "bin", "iso",
    "pdf", "doc", "docx", "xls", "xlsx",
    "wasm", "pyc", "class"
];

fn is_ignored(name: &str) -> bool {
    IGNORED_NAMES.iter().any(|&ign| ign.eq_ignore_ascii_case(name))
}

#[tauri::command]
pub async fn execute_tool(name: String, arguments: Value) -> Result<Value, String> {
    tokio::task::spawn_blocking(move || match name.as_str() {
        "web_search" => {
            let query = arguments.get("query")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            search::web_search(query)
        },
        "read_workspace_file" => {
            let path_str = arguments.get("path")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing 'path' argument".to_string())?;

            let mut p = PathBuf::from(path_str);
            if !p.exists() {
                if let Some(root) = arguments.get("root_path")
                    .or_else(|| arguments.get("project_folder"))
                    .or_else(|| arguments.get("folder_path"))
                    .and_then(|v| v.as_str())
                {
                    let clean = path_str.trim_start_matches('/').trim_start_matches('\\');
                    let candidate = PathBuf::from(root).join(clean);
                    if candidate.exists() {
                        p = candidate;
                    }
                }
            }

            if !p.exists() {
                return Err(format!("File does not exist: {}", path_str));
            }

            let metadata = fs::metadata(&p).map_err(|e| format!("Could not read file metadata: {}", e))?;
            if metadata.len() > 2 * 1024 * 1024 {
                return Err("File is too large (>2MB)".to_string());
            }

            let content = fs::read_to_string(&p)
                .map_err(|e| format!("Failed to read file: {}", e))?;

            let start_line = arguments.get("start_line").and_then(|v| v.as_u64()).unwrap_or(1) as usize;
            let end_line = arguments.get("end_line").and_then(|v| v.as_u64()).unwrap_or(500) as usize;

            let lines: Vec<&str> = content.lines().collect();
            let start = start_line.saturating_sub(1).min(lines.len());
            let end = end_line.min(lines.len());

            let slice = &lines[start..end];
            Ok(json!({
                "path": path_str,
                "start_line": start + 1,
                "end_line": end,
                "content": slice.join("\n"),
                "total_lines": lines.len()
            }))
        },
        "search_workspace_code" => {
            let root_path_str = arguments.get("root_path")
                .or_else(|| arguments.get("project_folder"))
                .or_else(|| arguments.get("folder_path"))
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing 'root_path' or 'project_folder' argument".to_string())?;

            let query = arguments.get("query")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing 'query' argument".to_string())?
                .to_lowercase();

            let root = PathBuf::from(root_path_str);
            if !root.exists() {
                return Err(format!("Root path does not exist: {}", root_path_str));
            }

            let mut matches = Vec::new();
            let mut queue = vec![root.clone()];
            let mut files_scanned = 0;

            while let Some(dir) = queue.pop() {
                if let Ok(entries) = fs::read_dir(&dir) {
                    for entry in entries.filter_map(|e| e.ok()) {
                        let p = entry.path();
                        let name = p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
                        if is_ignored(&name) || name.starts_with('.') {
                            continue;
                        }
                        if p.is_dir() {
                            queue.push(p);
                        } else if p.is_file() {
                            let ext = p.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
                            if BINARY_EXTENSIONS.contains(&ext.as_str()) {
                                continue;
                            }
                            if let Ok(meta) = fs::metadata(&p) {
                                if meta.len() > 1024 * 1024 {
                                    continue;
                                }
                            }
                            files_scanned += 1;
                            if let Ok(content) = fs::read_to_string(&p) {
                                for (idx, line) in content.lines().enumerate() {
                                    if line.to_lowercase().contains(&query) {
                                        let rel = p.strip_prefix(&root).unwrap_or(&p).to_string_lossy().replace('\\', "/");
                                        matches.push(json!({
                                            "file": rel,
                                            "line": idx + 1,
                                            "content": line.trim()
                                        }));
                                        if matches.len() >= 30 {
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                        if matches.len() >= 30 || files_scanned >= 500 {
                            break;
                        }
                    }
                }
                if matches.len() >= 30 || files_scanned >= 500 {
                    break;
                }
            }

            Ok(json!({
                "query": query,
                "matches": matches,
                "count": matches.len()
            }))
        },
        "list_workspace_files" => {
            let root_path_str = arguments.get("root_path")
                .or_else(|| arguments.get("project_folder"))
                .or_else(|| arguments.get("folder_path"))
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing 'root_path' or 'project_folder' argument".to_string())?;

            let subpath = arguments.get("subpath")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .trim_start_matches(['/', '\\']);

            let target_dir = PathBuf::from(root_path_str).join(subpath);
            if !target_dir.exists() {
                return Err(format!("Directory does not exist: {:?}", target_dir));
            }

            let mut files = Vec::new();
            if let Ok(entries) = fs::read_dir(&target_dir) {
                for entry in entries.filter_map(|e| e.ok()) {
                    let p = entry.path();
                    let name = p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
                    if is_ignored(&name) || name.starts_with('.') {
                        continue;
                    }
                    let is_dir = p.is_dir();
                    files.push(json!({
                        "name": name,
                        "is_dir": is_dir,
                    }));
                }
            }
            Ok(json!({
                "directory": subpath,
                "entries": files
            }))
        },
        _ => Err(format!("Unknown tool: {}", name)),
    })
    .await
    .map_err(|e| format!("Tool task failed: {}", e))?
}
