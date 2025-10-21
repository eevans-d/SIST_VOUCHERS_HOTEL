#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { logger } = require('../src/config/logger');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../vouchers.db');
const MIGRATIONS_DIR = path.join(__dirname, '../db/migrations');

// Tabla de control de migraciones
const MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    applied_at DATETIME DEFAULT (datetime('now', 'localtime'))
  )
`;

async function runMigrations() {
  console.log('🔄 Ejecutando migraciones...\n');
  
  try {
    const db = new Database(DB_PATH);
    
    // Crear tabla de migraciones
    db.exec(MIGRATIONS_TABLE);
    
    // Obtener migraciones aplicadas
    const appliedMigrations = db.prepare(
      'SELECT version FROM schema_migrations ORDER BY version'
    ).all().map(row => row.version);
    
    // Leer archivos de migración
    const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    let appliedCount = 0;
    
    for (const file of migrationFiles) {
      const version = file.replace('.sql', '');
      
      if (appliedMigrations.includes(version)) {
        console.log(`⏭️  Saltando ${version} (ya aplicada)`);
        continue;
      }
      
      console.log(`▶️  Aplicando ${version}...`);
      
      const migrationSQL = fs.readFileSync(
        path.join(MIGRATIONS_DIR, file),
        'utf8'
      );
      
      const transaction = db.transaction(() => {
        db.exec(migrationSQL);
        db.prepare(
          'INSERT INTO schema_migrations (version, name) VALUES (?, ?)'
        ).run(version, file);
      });
      
      transaction();
      
      console.log(`✓ ${version} aplicada exitosamente`);
      appliedCount++;
    }
    
    db.close();
    
    if (appliedCount === 0) {
      console.log('\n✅ No hay migraciones pendientes\n');
    } else {
      console.log(`\n✅ ${appliedCount} migración(es) aplicada(s) exitosamente!\n`);
    }
    
  } catch (error) {
    console.error('\n❌ Error ejecutando migraciones:', error.message);
    logger.error({
      event: 'migration_failed',
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Ejecutar
runMigrations();
