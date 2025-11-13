const jwt = require('jsonwebtoken');

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1];
}

function decodeToken(token, secret) {
  return jwt.verify(token, secret);
}

function mapDecodedToUser(decoded) {
  if (!decoded.user_id || !decoded.role) {
    const err = new Error('INVALID_TOKEN_STRUCTURE');
    throw err;
  }
  return {
    id: decoded.user_id,
    username: decoded.username,
    role: decoded.role,
    cafeteria_id: decoded.cafeteria_id
  };
}

function unauthorized(res, message = 'Token de autenticación requerido', code = 'NO_TOKEN') {
  return res.status(401).json({ error: code, message });
}

function invalidToken(res) {
  return res.status(401).json({
    error: 'INVALID_TOKEN',
    message: 'Token inválido o expirado'
  });
}

function forbidden(res, message = 'Permisos insuficientes para esta operación', code = 'INSUFFICIENT_PERMISSIONS') {
  return res.status(403).json({ error: code, message });
}

module.exports = {
  extractToken,
  decodeToken,
  mapDecodedToUser,
  unauthorized,
  invalidToken,
  forbidden
};
