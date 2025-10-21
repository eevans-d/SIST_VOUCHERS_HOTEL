#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { logger } = require('../src/config/logger');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../vouchers.db');
const SCHEMA_PATH = path.join(__dirname, '../db/schema.sql');
const SEEDS_PATH = path.join(__dirname, '../db/seeds/development.sql');

async function setupDatabase() {
  console.log('🗄️  Configurando base de datos...\n');
  
  try {
    // Crear directorio si no existe
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      console.log(`✓ Directorio creado: ${dbDir}`);
    }
    
    // Conectar a la base de datos
    const db = new Database(DB_PATH);
    console.log(`✓ Conectado a: ${DB_PATH}\n`);
    
    // Aplicar schema
    console.log('📋 Aplicando schema...');
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    db.exec(schema);
    console.log('✓ Schema aplicado exitosamente\n');
    
    // Aplicar seeds si estamos en desarrollo
    if (process.env.NODE_ENV !== 'production') {
      console.log('🌱 Aplicando seeds de desarrollo...');
      const seeds = fs.readFileSync(SEEDS_PATH, 'utf8');
      db.exec(seeds);
      console.log('✓ Seeds aplicados exitosamente\n');
    }
    
    // Verificar tablas
    console.log('🔍 Verificando tablas...');
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `).all();
    
    console.log(`✓ ${tables.length} tablas creadas:`);
    tables.forEach(table => {
      console.log(`  - ${table.name}`);
    });
    
    // Estadísticas
    console.log('\n📊 Estadísticas:');
    const stats = {
      cafeterias: db.prepare('SELECT COUNT(*) as count FROM cafeterias').get(),
      users: db.prepare('SELECT COUNT(*) as count FROM users').get(),
      stays: db.prepare('SELECT COUNT(*) as count FROM stays').get(),
      vouchers: db.prepare('SELECT COUNT(*) as count FROM vouchers').get(),
      redemptions: db.prepare('SELECT COUNT(*) as count FROM redemptions').get()
    };
    
    Object.entries(stats).forEach(([table, { count }]) => {
      console.log(`  ${table}: ${count} registros`);
    });
    
    db.close();
    
    console.log('\n✅ Base de datos configurada exitosamente!\n');
    
  } catch (error) {
    console.error('\n❌ Error configurando base de datos:', error.message);
    logger.error({
      event: 'db_setup_failed',
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Ejecutar
setupDatabase();
