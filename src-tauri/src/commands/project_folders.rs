use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::State;
use crate::db::Database;
use rusqlite::params;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub relative_path: String,
    pub is_dir: bool,
    pub size: u64,
    pub children: Option<Vec<FileNode>>,
}

// Ignore list for code scanning
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

const CODE_EXTENSIONS: &[&str] = &[
    "ts", "tsx", "js", "jsx", "mjs", "cjs",
    "py", "rs", "go", "java", "c", "cpp", "h", "hpp", "cs",
    "json", "yaml", "yml", "toml", "md", "txt", "sql", "sh", "bat", "ps1",
    "html", "css", "scss"
];

fn should_ignore(name: &str) -> bool {
    IGNORED_NAMES.iter().any(|&ign| ign.eq_ignore_ascii_case(name))
}

fn walk_directory(root: &Path, current: &Path, max_depth: usize) -> Option<FileNode> {
    if max_depth == 0 {
        return None;
    }

    let name = current.file_name()?.to_string_lossy().to_string();
    if should_ignore(&name) {
        return None;
    }

    let metadata = fs::metadata(current).ok()?;
    let is_dir = metadata.is_dir();
    let size = if is_dir { 0 } else { metadata.len() };
    let path = current.to_string_lossy().to_string();
    let relative_path = match current.strip_prefix(root) {
        Ok(rel) => rel.to_string_lossy().replace('\\', "/"),
        Err(_) => name.clone(),
    };

    let children = if is_dir {
        let mut list = Vec::new();
        if let Ok(entries) = fs::read_dir(current) {
            let mut entries: Vec<_> = entries.filter_map(|e| e.ok()).collect();
            // Sort: directories first, then alphabetical
            entries.sort_by_key(|e| {
                let is_directory = e.file_type().map(|t| t.is_dir()).unwrap_or(false);
                (!is_directory, e.file_name().to_string_lossy().to_lowercase())
            });

            for entry in entries {
                if let Some(child_node) = walk_directory(root, &entry.path(), max_depth - 1) {
                    list.push(child_node);
                }
            }
        }
        Some(list)
    } else {
        None
    };

    Some(FileNode {
        name,
        path,
        relative_path,
        is_dir,
        size,
        children,
    })
}

#[tauri::command]
pub async fn scan_project_folder(project_id: String, db: State<'_, Database>) -> Result<FileNode, String> {
    let folder_path: Option<String> = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT folder_path FROM projects WHERE id = ?1",
            params![project_id],
            |row| row.get(0),
        ).map_err(|e| format!("Project not found: {}", e))?
    };

    let root_path_str = folder_path.ok_or_else(|| "No folder linked to this project".to_string())?;
    let root_path = PathBuf::from(&root_path_str);
    if !root_path.exists() {
        return Err(format!("Linked folder does not exist: {}", root_path_str));
    }

    tokio::task::spawn_blocking(move || {
        walk_directory(&root_path, &root_path, 8)
            .ok_or_else(|| "Failed to scan project folder".to_string())
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn read_project_file_content(project_id: String, relative_path: String, db: State<'_, Database>) -> Result<String, String> {
    let folder_path: Option<String> = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT folder_path FROM projects WHERE id = ?1",
            params![project_id],
            |row| row.get(0),
        ).map_err(|e| format!("Project not found: {}", e))?
    };

    let root_path_str = folder_path.ok_or_else(|| "No folder linked to this project".to_string())?;

    tokio::task::spawn_blocking(move || {
        let root_path = PathBuf::from(&root_path_str);
        let clean_rel = relative_path.trim_start_matches('/').trim_start_matches('\\');
        let target_path = root_path.join(clean_rel);

        if !target_path.starts_with(&root_path) {
            return Err("Access denied: path is outside of project root".to_string());
        }

        if !target_path.exists() {
            return Err(format!("File does not exist: {}", clean_rel));
        }

        // Limit read size to 2 MB for text view
        let metadata = fs::metadata(&target_path).map_err(|e| e.to_string())?;
        if metadata.len() > 2 * 1024 * 1024 {
            return Err("File is too large to preview (>2MB)".to_string());
        }

        fs::read_to_string(&target_path)
            .map_err(|e| format!("Could not read text file (might be binary): {}", e))
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectWorkspaceSummary {
    pub folder_path: String,
    pub total_files: usize,
    pub file_list: Vec<String>,
    pub manifest_filename: Option<String>,
    pub manifest_content: Option<String>,
}

#[tauri::command]
pub async fn get_project_workspace_summary(project_id: String, db: State<'_, Database>) -> Result<ProjectWorkspaceSummary, String> {
    let folder_path: Option<String> = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT folder_path FROM projects WHERE id = ?1",
            params![project_id],
            |row| row.get(0),
        ).map_err(|e| format!("Project not found: {}", e))?
    };

    let root_path_str = folder_path.ok_or_else(|| "No folder linked to this project".to_string())?;

    tokio::task::spawn_blocking(move || {
        let root_path = PathBuf::from(&root_path_str);
        if !root_path.exists() {
            return Err(format!("Linked folder does not exist: {}", root_path_str));
        }

        let mut files = Vec::new();
        let mut queue = vec![root_path.clone()];

        while let Some(dir) = queue.pop() {
            if let Ok(entries) = fs::read_dir(&dir) {
                let mut entries: Vec<_> = entries.filter_map(|e| e.ok()).collect();
                entries.sort_by_key(|e| e.file_name());

                for entry in entries {
                    let p = entry.path();
                    let name = p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
                    if should_ignore(&name) {
                        continue;
                    }
                    if p.is_dir() {
                        queue.push(p);
                    } else if p.is_file() {
                        let ext = p.extension().map(|e| e.to_string_lossy().to_string()).unwrap_or_default();
                        if CODE_EXTENSIONS.contains(&ext.as_str()) || name.eq_ignore_ascii_case("readme.md") || name.eq_ignore_ascii_case("license") {
                            if let Ok(rel) = p.strip_prefix(&root_path) {
                                files.push(rel.to_string_lossy().replace('\\', "/"));
                            }
                        }
                    }
                }
            }
        }

        files.sort();
        let total_files = files.len();

        let candidate_manifests = [
            "README.md", "readme.md", "README",
            "package.json", "Cargo.toml", "pyproject.toml", "go.mod"
        ];

        let mut manifest_filename = None;
        let mut manifest_content = None;

        for candidate in candidate_manifests {
            let manifest_path = root_path.join(candidate);
            if manifest_path.exists() {
                if let Ok(txt) = fs::read_to_string(&manifest_path) {
                    manifest_filename = Some(candidate.to_string());
                    manifest_content = Some(txt.chars().take(4000).collect());
                    break;
                }
            }
        }

        let file_list = if files.len() > 120 {
            let mut truncated = files[..120].to_vec();
            truncated.push(format!("... and {} more files", files.len() - 120));
            truncated
        } else {
            files
        };

        Ok(ProjectWorkspaceSummary {
            folder_path: root_path_str,
            total_files,
            file_list,
            manifest_filename,
            manifest_content,
        })
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}


#[derive(Debug, Serialize, Deserialize)]
pub struct ParseCodebaseResult {
    pub nodes_created: usize,
    pub edges_created: usize,
}

#[tauri::command]
pub fn parse_codebase_to_graph(project_id: String, db: State<Database>) -> Result<ParseCodebaseResult, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let folder_path: Option<String> = conn.query_row(
        "SELECT folder_path FROM projects WHERE id = ?1",
        params![project_id],
        |row| row.get(0),
    ).map_err(|e| format!("Project not found: {}", e))?;

    let root_path_str = folder_path.ok_or_else(|| "No folder linked to this project".to_string())?;
    let root_path = PathBuf::from(&root_path_str);
    if !root_path.exists() {
        return Err("Linked folder does not exist".to_string());
    }

    // Collect code files
    let mut files_to_scan = Vec::new();
    let mut queue = vec![root_path.clone()];

    while let Some(dir) = queue.pop() {
        if let Ok(entries) = fs::read_dir(&dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let p = entry.path();
                let name = p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
                if should_ignore(&name) {
                    continue;
                }
                if p.is_dir() {
                    queue.push(p);
                } else if p.is_file() {
                    let ext = p.extension().map(|e| e.to_string_lossy().to_string()).unwrap_or_default();
                    if CODE_EXTENSIONS.contains(&ext.as_str()) {
                        files_to_scan.push(p);
                    }
                }
            }
        }
    }

    // Limit scanned files to prevent overwhelming the graph
    files_to_scan.truncate(100);

    let now = chrono::Utc::now().to_rfc3339();
    let mut nodes_created = 0;
    let mut edges_created = 0;

    // Remove previously extracted code nodes for this project to refresh cleanly
    conn.execute(
        "DELETE FROM graph_nodes WHERE project_id = ?1 AND domain = 'code'",
        params![project_id],
    ).map_err(|e| e.to_string())?;

    for file_path in files_to_scan {
        let rel_path = match file_path.strip_prefix(&root_path) {
            Ok(rel) => rel.to_string_lossy().replace('\\', "/"),
            Err(_) => continue,
        };

        let file_name = file_path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
        let file_node_id = uuid::Uuid::new_v4().to_string();

        let file_metadata = serde_json::json!({
            "rel_path": rel_path,
            "kind": "file",
            "relevance": 0.8
        }).to_string();

        conn.execute(
            "INSERT INTO graph_nodes (id, label, category, color, x, y, metadata, project_id, domain, created_at, updated_at)
             VALUES (?1, ?2, 'TOOL', '#10B981', ?3, ?4, ?5, ?6, 'code', ?7, ?7)",
            params![
                file_node_id,
                file_name,
                (rand_pos() * 600.0) - 300.0,
                (rand_pos() * 600.0) - 300.0,
                file_metadata,
                project_id,
                now
            ],
        ).map_err(|e| e.to_string())?;
        nodes_created += 1;

        // Read content to extract functions / classes via lightweight parsing
        if let Ok(content) = fs::read_to_string(&file_path) {
            for line in content.lines().take(500) {
                let trimmed = line.trim();
                let fn_name = if trimmed.starts_with("pub fn ") || trimmed.starts_with("fn ") {
                    trimmed.split_whitespace().nth(if trimmed.starts_with("pub ") { 2 } else { 1 })
                        .and_then(|s| s.split('(').next())
                } else if trimmed.starts_with("function ") || trimmed.starts_with("export function ") {
                    trimmed.split_whitespace().nth(if trimmed.starts_with("export ") { 2 } else { 1 })
                        .and_then(|s| s.split('(').next())
                } else if trimmed.starts_with("def ") {
                    trimmed.split_whitespace().nth(1)
                        .and_then(|s| s.split('(').next())
                } else {
                    None
                };

                if let Some(name) = fn_name {
                    let clean_name = name.trim_matches(|c: char| !c.is_alphanumeric() && c != '_');
                    if clean_name.len() > 2 && clean_name.len() < 40 {
                        let fn_node_id = uuid::Uuid::new_v4().to_string();
                        let fn_metadata = serde_json::json!({
                            "rel_path": rel_path,
                            "kind": "function",
                            "relevance": 0.9
                        }).to_string();

                        conn.execute(
                            "INSERT INTO graph_nodes (id, label, category, color, x, y, metadata, project_id, domain, created_at, updated_at)
                             VALUES (?1, ?2, 'ACTION', '#059669', ?3, ?4, ?5, ?6, 'code', ?7, ?7)",
                            params![
                                fn_node_id,
                                clean_name,
                                (rand_pos() * 600.0) - 300.0,
                                (rand_pos() * 600.0) - 300.0,
                                fn_metadata,
                                project_id,
                                now
                            ],
                        ).map_err(|e| e.to_string())?;
                        nodes_created += 1;

                        // Edge: file defines function
                        let edge_id = uuid::Uuid::new_v4().to_string();
                        conn.execute(
                            "INSERT INTO graph_edges (id, source_id, target_id, label, metadata, project_id, edge_type, created_at)
                             VALUES (?1, ?2, ?3, 'defines', '{}', ?4, 'structural', ?5)",
                            params![edge_id, file_node_id, fn_node_id, project_id, now],
                        ).map_err(|e| e.to_string())?;
                        edges_created += 1;
                    }
                }
            }
        }
    }

    Ok(ParseCodebaseResult {
        nodes_created,
        edges_created,
    })
}

fn rand_pos() -> f64 {
    (uuid::Uuid::new_v4().as_u128() % 1000) as f64 / 1000.0
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InputChunk {
    pub file_path: String,
    pub chunk_text: String,
    pub start_line: usize,
    pub end_line: usize,
    pub embedding: Option<Vec<f32>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchChunkResult {
    pub file_path: String,
    pub chunk_text: String,
    pub start_line: usize,
    pub end_line: usize,
    pub score: f32,
}

#[tauri::command]
pub fn get_code_chunks_count(project_id: String, db: State<Database>) -> Result<usize, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let count: usize = conn.query_row(
        "SELECT COUNT(*) FROM code_chunks WHERE project_id = ?1",
        params![project_id],
        |row| row.get(0),
    ).unwrap_or(0);
    Ok(count)
}

#[tauri::command]
pub fn clear_code_chunks(project_id: String, db: State<Database>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM code_chunks WHERE project_id = ?1",
        params![project_id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn prepare_project_code_chunks(project_id: String, db: State<Database>) -> Result<Vec<InputChunk>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let folder_path: Option<String> = conn.query_row(
        "SELECT folder_path FROM projects WHERE id = ?1",
        params![project_id],
        |row| row.get(0),
    ).map_err(|e| format!("Project not found: {}", e))?;

    let root_path_str = folder_path.ok_or_else(|| "No folder linked to this project".to_string())?;
    let root_path = PathBuf::from(&root_path_str);
    if !root_path.exists() {
        return Err("Linked folder does not exist".to_string());
    }

    let mut files_to_scan = Vec::new();
    let mut queue = vec![root_path.clone()];

    while let Some(dir) = queue.pop() {
        if let Ok(entries) = fs::read_dir(&dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let p = entry.path();
                let name = p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
                if should_ignore(&name) {
                    continue;
                }
                if p.is_dir() {
                    queue.push(p);
                } else if p.is_file() {
                    let ext = p.extension().map(|e| e.to_string_lossy().to_string()).unwrap_or_default();
                    if CODE_EXTENSIONS.contains(&ext.as_str()) {
                        files_to_scan.push(p);
                    }
                }
            }
        }
    }

    // Cap scanned files to 150
    files_to_scan.truncate(150);

    let mut chunks = Vec::new();
    let max_lines = 40;
    let overlap = 10;

    for file_path in files_to_scan {
        let rel_path = match file_path.strip_prefix(&root_path) {
            Ok(rel) => rel.to_string_lossy().replace('\\', "/"),
            Err(_) => continue,
        };

        let metadata = match fs::metadata(&file_path) {
            Ok(m) => m,
            Err(_) => continue,
        };
        // Skip files > 500KB
        if metadata.len() > 500 * 1024 {
            continue;
        }

        if let Ok(content) = fs::read_to_string(&file_path) {
            let lines: Vec<&str> = content.lines().collect();
            let mut start = 0;
            while start < lines.len() {
                let end = std::cmp::min(start + max_lines, lines.len());
                let chunk_lines = &lines[start..end];
                let chunk_text = chunk_lines.join("\n").trim().to_string();

                if chunk_text.len() > 20 {
                    chunks.push(InputChunk {
                        file_path: rel_path.clone(),
                        chunk_text,
                        start_line: start + 1,
                        end_line: end,
                        embedding: None,
                    });
                }

                if end == lines.len() {
                    break;
                }
                start += std::cmp::max(1, max_lines - overlap);
            }
        }
    }

    // Cap at 1000 chunks max per project
    chunks.truncate(1000);
    Ok(chunks)
}

#[tauri::command]
pub fn index_code_chunks(project_id: String, chunks: Vec<InputChunk>, db: State<Database>) -> Result<usize, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    let mut count = 0;
    for chunk in chunks {
        let id = uuid::Uuid::new_v4().to_string();
        let embedding_bytes: Option<Vec<u8>> = chunk.embedding.map(|vec| {
            vec.iter().flat_map(|val| val.to_le_bytes()).collect()
        });

        conn.execute(
            "INSERT INTO code_chunks (id, project_id, file_path, chunk_text, start_line, end_line, embedding, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![id, project_id, chunk.file_path, chunk.chunk_text, chunk.start_line, chunk.end_line, embedding_bytes, now],
        ).map_err(|e| e.to_string())?;
        count += 1;
    }

    Ok(count)
}

#[tauri::command]
pub fn search_code_chunks(
    project_id: String,
    query_embedding: Vec<f32>,
    limit: usize,
    db: State<Database>,
) -> Result<Vec<SearchChunkResult>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT file_path, chunk_text, start_line, end_line, embedding
         FROM code_chunks WHERE project_id = ?1 AND embedding IS NOT NULL"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(params![project_id], |row| {
        let file_path: String = row.get(0)?;
        let chunk_text: String = row.get(1)?;
        let start_line: usize = row.get(2)?;
        let end_line: usize = row.get(3)?;
        let raw_blob: Vec<u8> = row.get(4)?;
        Ok((file_path, chunk_text, start_line, end_line, raw_blob))
    }).map_err(|e| e.to_string())?;

    let mut scored: Vec<SearchChunkResult> = Vec::new();

    for row_res in rows.flatten() {
        let (file_path, chunk_text, start_line, end_line, raw_blob) = row_res;
        if raw_blob.len() % 4 != 0 {
            continue;
        }

        let chunk_vec: Vec<f32> = raw_blob
            .chunks_exact(4)
            .map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]]))
            .collect();

        let score = cosine_similarity(&query_embedding, &chunk_vec);
        scored.push(SearchChunkResult {
            file_path,
            chunk_text,
            start_line,
            end_line,
            score,
        });
    }

    scored.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(limit.max(1));

    Ok(scored)
}

fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let mut dot = 0.0;
    let mut norm_a = 0.0;
    let mut norm_b = 0.0;
    for i in 0..a.len() {
        dot += a[i] * b[i];
        norm_a += a[i] * a[i];
        norm_b += b[i] * b[i];
    }
    let denom = norm_a.sqrt() * norm_b.sqrt();
    if denom == 0.0 { 0.0 } else { dot / denom }
}
