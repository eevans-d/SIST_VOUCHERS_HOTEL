#!/usr/bin/env node

/**
 * run-migrations.js
 * 
 * Ejecuta migrations SQL contra base de datos PostgreSQL en Railway.
 * Usa DATABASE_URL desde .env o variables de entorno Railway.
 * 
 * Uso:
 *   node scripts/run-migrations.js
 *   DATABASE_URL=postgresql://... node scripts/run-migrations.js
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Client } = pg;

// Resolver paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MIGRATIONS_DIR = join(__dirname, 'migrations');

// Database URL desde env
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL no está definida');
  console.error('');
  console.error('Uso:');
  console.error('  DATABASE_URL=postgresql://user:pass@host:port/db node scripts/run-migrations.js');
  console.error('');
  console.error('O define DATABASE_URL en .env');
  process.exit(1);
}

// Lista de migrations en orden
// Definición de pasos de migración
// 1) SQL files en MIGRATIONS_DIR
// 2) Pasos especiales (JS) como 'SEED_ADMIN'
const MIGRATIONS = [
  { type: 'sql', name: '001-initial-schema.sql' },
  { type: 'seed-admin', name: 'SEED_ADMIN' }
];

/**
 * Ejecuta una migration SQL
 */
async function runSqlMigration(client, filename) {
  const filepath = join(MIGRATIONS_DIR, filename);
  
  console.log(`\n📄 Ejecutando migration: ${filename}`);
  console.log(`   Path: ${filepath}`);
  
  try {
    const sql = readFileSync(filepath, 'utf-8');
    
    // Ejecutar SQL
    await client.query(sql);
    
    console.log(`✅ Migration ${filename} ejecutada exitosamente`);
    return { filename, success: true };
  } catch (error) {
    console.error(`❌ Error ejecutando migration ${filename}:`);
    console.error(`   ${error.message}`);
    
    return { filename, success: false, error: error.message };
  }
}

/**
 * Paso especial: Seed/Upsert del usuario admin
 * Usa ADMIN_EMAIL (default: admin@hotel.com) y ADMIN_PASSWORD (requerida)
 */
async function runSeedAdmin(client) {
  console.log(`\n👤 Ejecutando seed de usuario admin`);
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@hotel.com';
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.warn('⚠️  ADMIN_PASSWORD no definida, se omite seed de admin.');
    return { filename: 'SEED_ADMIN', success: true, skipped: true };
  }

  // Import dinámico para no añadir costos si no se usa
  const bcrypt = (await import('bcryptjs')).default;
  const hash = bcrypt.hashSync(adminPassword, 10);

  const now = new Date();
  try {
    // Upsert por email
    await client.query(
      `INSERT INTO users (id, email, "passwordHash", "firstName", "lastName", role, "isActive", "createdAt", "updatedAt")
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, 'admin', true, NOW(), NOW())
       ON CONFLICT (email)
       DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash",
                     role = 'admin',
                     "isActive" = true,
                     "updatedAt" = NOW()`,
      [adminEmail, hash, 'Admin', 'User']
    );

    console.log(`✅ Admin seed OK para ${adminEmail}`);
    return { filename: 'SEED_ADMIN', success: true };
  } catch (error) {
    console.error('❌ Error en seed admin:', error.message);
    return { filename: 'SEED_ADMIN', success: false, error: error.message };
  }
}

/**
 * Main: Conectar y ejecutar todas las migrations
 */
async function main() {
  console.log('🚀 PostgreSQL Migrations Runner');
  console.log('================================');
  console.log('');
  console.log(`📍 Database URL: ${DATABASE_URL.replace(/:[^:]*@/, ':****@')}`);
  console.log(`📂 Migrations dir: ${MIGRATIONS_DIR}`);
  console.log(`📋 Total migrations: ${MIGRATIONS.length}`);
  
  // Crear cliente PostgreSQL
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false } // Railway requiere SSL en prod
      : false
  });
  
  try {
    // Conectar
    console.log('\n🔌 Conectando a PostgreSQL...');
    await client.connect();
    console.log('✅ Conexión exitosa');
    
    // Ejecutar migrations
    const results = [];
    
    for (const step of MIGRATIONS) {
      let result;
      if (step.type === 'sql') {
        result = await runSqlMigration(client, step.name);
      } else if (step.type === 'seed-admin') {
        result = await runSeedAdmin(client);
      } else {
        console.warn(`Paso de migración desconocido: ${step.type}`);
        result = { filename: step.name, success: true, skipped: true };
      }
      results.push(result);
      
      // Detener si alguna migration falla
      if (!result.success) {
        console.error('\n❌ Migration fallida, deteniendo ejecución');
        break;
      }
    }
    
    // Resumen
    console.log('\n================================');
    console.log('📊 RESUMEN DE MIGRATIONS');
    console.log('================================');
    
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const skipped = results.filter(r => r.skipped).length;
    
    console.log(`✅ Exitosas: ${successful}/${MIGRATIONS.length}`);
    console.log(`❌ Fallidas: ${failed}/${MIGRATIONS.length}`);
  if (skipped > 0) console.log(`⏭️  Omitidas: ${skipped}`);
    
    if (failed > 0) {
      console.log('\n❌ Algunas migrations fallaron. Revisar logs arriba.');
      process.exit(1);
    } else {
      console.log('\n✅ Todas las migrations ejecutadas exitosamente');
      
      // Verificar tablas creadas
      console.log('\n🔍 Verificando tablas creadas...');
      const tablesResult = await client.query(`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        ORDER BY tablename
      `);
      
      console.log(`\n📊 Total tablas: ${tablesResult.rows.length}`);
      tablesResult.rows.forEach(row => {
        console.log(`   - ${row.tablename}`);
      });
      
      // Verificar índices
      console.log('\n🔍 Verificando índices...');
      const indexesResult = await client.query(`
        SELECT indexname, tablename 
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        ORDER BY tablename, indexname
      `);
      
      console.log(`\n📊 Total índices: ${indexesResult.rows.length}`);
      
      // Agrupar índices por tabla
      const indexesByTable = {};
      indexesResult.rows.forEach(row => {
        if (!indexesByTable[row.tablename]) {
          indexesByTable[row.tablename] = [];
        }
        indexesByTable[row.tablename].push(row.indexname);
      });
      
      Object.entries(indexesByTable).forEach(([table, indexes]) => {
        console.log(`\n   ${table} (${indexes.length} índices):`);
        indexes.forEach(idx => {
          console.log(`     - ${idx}`);
        });
      });
      
      console.log('\n🎉 Database setup completado exitosamente');
    }
    
  } catch (error) {
    console.error('\n❌ Error fatal:');
    console.error(error);
    process.exit(1);
  } finally {
    // Cerrar conexión
    await client.end();
    console.log('\n🔌 Conexión cerrada');
  }
}

// Ejecutar
main().catch(error => {
  console.error('❌ Error no manejado:', error);
  process.exit(1);
});
