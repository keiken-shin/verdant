use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::Database;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GraphNode {
    pub id: String,
    pub label: String,
    pub category: String,
    pub color: Option<String>,
    pub x: f64,
    pub y: f64,
    pub metadata: String,
    pub project_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GraphEdge {
    pub id: String,
    pub source_id: String,
    pub target_id: String,
    pub label: Option<String>,
    pub metadata: String,
    pub project_id: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateNodeInput {
    pub label: String,
    pub category: String,
    pub color: Option<String>,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub project_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateEdgeInput {
    pub source_id: String,
    pub target_id: String,
    pub label: Option<String>,
    pub project_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateNodePositionInput {
    pub id: String,
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GraphData {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

fn category_to_color(category: &str) -> String {
    match category {
        "CONCEPT"  => "#5A67D8".to_string(),
        "READING"  => "#E8853D".to_string(),
        "CORE"     => "#1A1A1A".to_string(),
        "IDEA"     => "#9F5AD8".to_string(),
        "ESSAY"    => "#38A169".to_string(),
        "RESEARCH" => "#3B82F6".to_string(),
        "DESIGN"   => "#1E3A5F".to_string(),
        _          => "#5A67D8".to_string(),
    }
}

// project_id = None returns the entire graph (global /knowledge-graph page).
// Some(id) scopes to one project's nodes/edges.
#[tauri::command]
pub fn get_graph_data(project_id: Option<String>, db: State<Database>) -> Result<GraphData, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut node_stmt = conn.prepare(
        "SELECT id, label, category, color, x, y, metadata, project_id, created_at, updated_at FROM graph_nodes
         WHERE (?1 IS NULL OR project_id = ?1)"
    ).map_err(|e| e.to_string())?;

    let nodes: Vec<GraphNode> = node_stmt.query_map(params![project_id], |row| {
        let category: String = row.get(2)?;
        let color: Option<String> = row.get(3)?;
        Ok(GraphNode {
            id: row.get(0)?,
            label: row.get(1)?,
            color: Some(color.unwrap_or_else(|| category_to_color(&category))),
            category,
            x: row.get(4)?,
            y: row.get(5)?,
            metadata: row.get(6)?,
            project_id: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    let mut edge_stmt = conn.prepare(
        "SELECT id, source_id, target_id, label, metadata, project_id, created_at FROM graph_edges
         WHERE (?1 IS NULL OR project_id = ?1)"
    ).map_err(|e| e.to_string())?;

    let edges: Vec<GraphEdge> = edge_stmt.query_map(params![project_id], |row| {
        Ok(GraphEdge {
            id: row.get(0)?,
            source_id: row.get(1)?,
            target_id: row.get(2)?,
            label: row.get(3)?,
            metadata: row.get(4)?,
            project_id: row.get(5)?,
            created_at: row.get(6)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    Ok(GraphData { nodes, edges })
}

#[tauri::command]
pub fn create_graph_node(input: CreateNodeInput, db: State<Database>) -> Result<GraphNode, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let color = input.color.unwrap_or_else(|| category_to_color(&input.category));
    let x = input.x.unwrap_or(0.0);
    let y = input.y.unwrap_or(0.0);

    conn.execute(
        "INSERT INTO graph_nodes (id, label, category, color, x, y, metadata, project_id, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, '{}', ?7, ?8, ?9)",
        params![id, input.label, input.category, color, x, y, input.project_id, now, now],
    ).map_err(|e| e.to_string())?;

    Ok(GraphNode {
        id,
        label: input.label,
        category: input.category,
        color: Some(color),
        x, y,
        metadata: "{}".to_string(),
        project_id: input.project_id,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub fn create_graph_edge(input: CreateEdgeInput, db: State<Database>) -> Result<GraphEdge, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO graph_edges (id, source_id, target_id, label, metadata, project_id, created_at)
         VALUES (?1, ?2, ?3, ?4, '{}', ?5, ?6)",
        params![id, input.source_id, input.target_id, input.label, input.project_id, now],
    ).map_err(|e| e.to_string())?;

    Ok(GraphEdge {
        id,
        source_id: input.source_id,
        target_id: input.target_id,
        label: input.label,
        metadata: "{}".to_string(),
        project_id: input.project_id,
        created_at: now,
    })
}

#[tauri::command]
pub fn update_node_positions(positions: Vec<UpdateNodePositionInput>, db: State<Database>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    for pos in positions {
        conn.execute(
            "UPDATE graph_nodes SET x = ?1, y = ?2, updated_at = ?3 WHERE id = ?4",
            params![pos.x, pos.y, now, pos.id],
        ).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn delete_graph_node(id: String, db: State<Database>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM graph_nodes WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_graph_edge(id: String, db: State<Database>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM graph_edges WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct BulkImportInput {
    pub nodes: Vec<CreateNodeInput>,
    pub edges: Vec<CreateEdgeInput>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExtractionRecord {
    pub session_id: String,
    pub model_id: Option<String>,
    pub node_count: i64,
    pub edge_count: i64,
}

#[tauri::command]
pub fn record_graph_extraction(input: ExtractionRecord, db: State<Database>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO graph_extractions (id, session_id, model_id, status, extracted_at, node_count, edge_count)
         VALUES (?1, ?2, ?3, 'completed', ?4, ?5, ?6)",
        params![id, input.session_id, input.model_id, now, input.node_count, input.edge_count],
    ).map_err(|e| e.to_string())?;
    Ok(())
}
