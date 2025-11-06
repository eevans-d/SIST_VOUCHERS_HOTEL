#!/usr/bin/env node
/*
 * Test de verificación de password con el hash en la BD e2e
 */
import bcrypt from 'bcryptjs';

const plainPassword = 'password123';
const storedHash = '$2a$10$g.wk3oZqCMVsbg6CsnQPp.XgKkpNfE7VtI2ZbH4G/tC4cZd1hjMp2'; // Hash del usuario admin en e2e.db (ajustar si cambió)

async function main() {
  const valid = await bcrypt.compare(plainPassword, storedHash);
  // eslint-disable-next-line no-console
  console.log(`¿Password válido? ${valid}`);
}

main();
