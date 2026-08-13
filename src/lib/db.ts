import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const dbPath = process.env.DATABASE_PATH ?? path.join(dataDir, "app.db");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const globalForDb = globalThis as unknown as { __waDb?: Database.Database };

function createDb() {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  migrate(db);
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY,
      email      TEXT NOT NULL UNIQUE,
      full_name  TEXT,
      phone      TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS otp_codes (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      code_hash  TEXT NOT NULL,
      attempts   INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id             TEXT PRIMARY KEY,
      user_id        TEXT NOT NULL,
      name           TEXT NOT NULL,
      message        TEXT NOT NULL,
      interval_secs  INTEGER NOT NULL DEFAULT 5,
      status         TEXT NOT NULL DEFAULT 'draft',
      total_count    INTEGER NOT NULL DEFAULT 0,
      success_count  INTEGER NOT NULL DEFAULT 0,
      failed_count   INTEGER NOT NULL DEFAULT 0,
      unsent_count   INTEGER NOT NULL DEFAULT 0,
      has_attachment INTEGER NOT NULL DEFAULT 0,
      scheduled_for  TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      started_at     TEXT,
      completed_at   TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS recipients (
      id          TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      number      TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'pending',
      error       TEXT,
      sent_at     TEXT,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_recipients_campaign ON recipients(campaign_id);

    CREATE TABLE IF NOT EXISTS attachments (
      id          TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      kind        TEXT NOT NULL,
      name        TEXT NOT NULL,
      url         TEXT NOT NULL,
      size        INTEGER NOT NULL DEFAULT 0,
      mime        TEXT,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS templates (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      name       TEXT NOT NULL,
      content    TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS wa_sessions (
      id           TEXT PRIMARY KEY,
      phone_number TEXT NOT NULL,
      push_name    TEXT,
      status       TEXT NOT NULL DEFAULT 'connected',
      connected_at TEXT NOT NULL DEFAULT (datetime('now')),
      disconnected_at TEXT
    );
  `);

  migrateAddColumns(db);
}

/** In-place migrations for pre-existing databases. */
function migrateAddColumns(db: Database.Database) {
  const campaignCols = (db.pragma("table_info(campaigns)") as { name: string }[]).map(
    (c) => c.name,
  );
  if (!campaignCols.includes("scheduled_for")) {
    db.exec("ALTER TABLE campaigns ADD COLUMN scheduled_for TEXT");
  }

  const userCols = (db.pragma("table_info(users)") as { name: string }[]).map((c) => c.name);
  if (!userCols.includes("full_name")) {
    db.exec("ALTER TABLE users ADD COLUMN full_name TEXT");
  }
  if (!userCols.includes("phone")) {
    db.exec("ALTER TABLE users ADD COLUMN phone TEXT");
  }
}

export const db = globalForDb.__waDb ?? (globalForDb.__waDb = createDb());
