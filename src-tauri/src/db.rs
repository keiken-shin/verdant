use rusqlite::{Connection, Result as SqliteResult};
use std::sync::Mutex;

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(db_path: &str) -> SqliteResult<Self> {
        let conn = Connection::open(db_path)?;
        let db = Database {
            conn: Mutex::new(conn),
        };
        db.initialize()?;
        Ok(db)
    }

    fn initialize(&self) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        // Enable WAL mode for better concurrent performance
        conn.execute_batch("PRAGMA journal_mode=WAL;")?;
        conn.execute_batch("PRAGMA foreign_keys=ON;")?;
        self.run_migrations(&conn)?;
        Ok(())
    }

    fn run_migrations(&self, conn: &Connection) -> SqliteResult<()> {
        conn.execute_batch("
            CREATE TABLE IF NOT EXISTS schema_version (
                version INTEGER PRIMARY KEY,
                applied_at TEXT NOT NULL
            );
        ")?;

        let version: i64 = conn
            .query_row(
                "SELECT COALESCE(MAX(version), 0) FROM schema_version",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);

        if version < 1 {
            conn.execute_batch(include_str!("../migrations/001_initial.sql"))?;
            conn.execute(
                "INSERT INTO schema_version (version, applied_at) VALUES (1, datetime('now'))",
                [],
            )?;
        }

        if version < 2 {
            conn.execute_batch(include_str!("../migrations/002_projects.sql"))?;
            conn.execute(
                "INSERT INTO schema_version (version, applied_at) VALUES (2, datetime('now'))",
                [],
            )?;
        }

        if version < 3 {
            conn.execute_batch(include_str!("../migrations/003_message_parent.sql"))?;
            conn.execute(
                "INSERT INTO schema_version (version, applied_at) VALUES (3, datetime('now'))",
                [],
            )?;
        }

        if version < 4 {
            conn.execute_batch(include_str!("../migrations/004_personas.sql"))?;
            conn.execute(
                "INSERT INTO schema_version (version, applied_at) VALUES (4, datetime('now'))",
                [],
            )?;
        }

        if version < 5 {
            conn.execute_batch(include_str!("../migrations/005_object_store.sql"))?;
            conn.execute(
                "INSERT INTO schema_version (version, applied_at) VALUES (5, datetime('now'))",
                [],
            )?;
        }

        if version < 6 {
            conn.execute_batch(include_str!("../migrations/006_project_file_inclusion.sql"))?;
            conn.execute(
                "INSERT INTO schema_version (version, applied_at) VALUES (6, datetime('now'))",
                [],
            )?;
        }

        if version < 7 {
            conn.execute_batch(include_str!("../migrations/007_project_file_summary.sql"))?;
            conn.execute(
                "INSERT INTO schema_version (version, applied_at) VALUES (7, datetime('now'))",
                [],
            )?;
        }

        if version < 8 {
            conn.execute_batch(include_str!("../migrations/008_graph_category_migration.sql"))?;
            conn.execute(
                "INSERT INTO schema_version (version, applied_at) VALUES (8, datetime('now'))",
                [],
            )?;
        }

        if version < 9 {
            conn.execute_batch(include_str!("../migrations/009_tool_calls.sql"))?;
            conn.execute(
                "INSERT INTO schema_version (version, applied_at) VALUES (9, datetime('now'))",
                [],
            )?;
        }

        Ok(())
    }
}
