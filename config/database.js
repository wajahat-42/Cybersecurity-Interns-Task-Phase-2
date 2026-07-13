const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/app.db');
let sqlDb = null;
let SQL = null;

function saveDatabase() {
  if (!sqlDb) return;
  const data = sqlDb.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function getDB() {
  if (!sqlDb) throw new Error('Database not initialized. Call initDatabase() first.');
  return {
    exec: (sql) => sqlDb.exec(sql),
    prepare: (sql) => {
      const stmt = sqlDb.prepare(sql);
      return {
        get: (...params) => {
          const args = Array.isArray(params[0]) ? params[0] : params;
          const row = stmt.getAsObject(args);
          if (!row || Object.values(row).every(v => v === undefined)) return undefined;
          return row;
        },
        all: (...params) => {
          const args = Array.isArray(params[0]) ? params[0] : params;
          stmt.bind(args);
          const results = [];
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          return results;
        },
        run: (...params) => {
          const args = Array.isArray(params[0]) ? params[0] : params;
          stmt.run(args);
          const changes = sqlDb.getRowsModified();
          let lastInsertRowid = undefined;
          try {
            const result = sqlDb.exec('SELECT last_insert_rowid() as id');
            if (result.length > 0 && result[0].values.length > 0) {
              lastInsertRowid = result[0].values[0][0];
            }
          } catch (e) {}
          saveDatabase();
          return { lastInsertRowid, changes };
        }
      };
    }
  };
}

async function initDatabase() {
  SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    sqlDb = new SQL.Database(buffer);
  } else {
    sqlDb = new SQL.Database();
  }

  sqlDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      api_key TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      login_attempts INTEGER DEFAULT 0,
      locked_until DATETIME
    );
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  sqlDb.run('PRAGMA foreign_keys = ON');
  saveDatabase();
  console.log('[DB] Initialized successfully');
}

module.exports = { initDatabase, getDB, saveDatabase };
