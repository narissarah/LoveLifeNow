const { neon } = require('@netlify/neon');

let sql;

function getPool() {
  if (!sql) {
    sql = neon();
  }
  return sql;
}

async function initDb() {
  const pool = getPool();
  await pool`
    CREATE TABLE IF NOT EXISTS submission_status (
      submission_id TEXT PRIMARY KEY,
      form_type TEXT NOT NULL,
      is_read BOOLEAN DEFAULT false,
      is_archived BOOLEAN DEFAULT false,
      is_deleted BOOLEAN DEFAULT false,
      notes TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await pool`CREATE INDEX IF NOT EXISTS idx_status_form ON submission_status(form_type)`;
  await pool`CREATE INDEX IF NOT EXISTS idx_status_deleted ON submission_status(is_deleted)`;
}

module.exports = { getPool, initDb };
