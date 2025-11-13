import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dbManager } from '../src/config/database.js';
import { JWTService } from '../src/infrastructure/security/JWTService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar el esquema de la base de datos
const schemaPath = path.join(__dirname, '../db/schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

// Inicializar JWTService para generar tokens de prueba
const jwtService = new JWTService(
  'test-secret-change-in-production-min-32-chars-long!!',
  'test-refresh-secret-change-in-production-min-32-chars'
);

// Función para generar tokens de prueba
global.generateTestToken = (userId, role) => {
  return jwtService.generateToken({ id: userId, role });
};

beforeAll(() => {
  // Asegurarse de que la base de datos esté inicializada en memoria para los tests
  const db = dbManager.getDb();
  db.exec(schema);
});

afterEach(() => {
  // Limpiar la base de datos después de cada test para asegurar aislamiento
  const db = dbManager.getDb();
  db.exec(`
    DELETE FROM users;
    DELETE FROM cafeterias;
    DELETE FROM stays;
    DELETE FROM vouchers;
    DELETE FROM redemptions;
    DELETE FROM sync_log;
  `);
});

afterAll(() => {
  // Cerrar la conexión a la base de datos después de todos los tests
  dbManager.close();
});
