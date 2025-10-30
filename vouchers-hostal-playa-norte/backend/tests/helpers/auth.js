import jwt from 'jsonwebtoken';

// Genera un token de prueba simple.
// Como el middleware de authenticate solo verifica presencia del token,
// el token puede ser arbitrario. Para mayor realismo, firmamos con JWT_SECRET si existe.
export function generateTestToken(userId = 1, role = 'admin') {
  const secret = process.env.JWT_SECRET || 'test-secret-min-32-chars-test-secret-min-32';
  // Asegurar mínimo 32 chars
  const key = secret.length >= 32 ? secret : (secret + secret + secret);

  const payload = {
    sub: String(userId),
    role,
    iat: Math.floor(Date.now() / 1000),
  };

  try {
    return jwt.sign(payload, key, { algorithm: 'HS256', expiresIn: '1h' });
  } catch {
    // Fallback a string simple si fallara firmar (no debería)
    return `test-token-${userId}-${role}`;
  }
}

export default { generateTestToken };
