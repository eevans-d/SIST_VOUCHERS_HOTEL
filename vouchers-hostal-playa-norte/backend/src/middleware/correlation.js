const { v4: uuidv4 } = require('uuid');

function correlationMiddleware(req, res, next) {
  // Obtener o generar correlation ID
  const correlationId = req.headers['x-correlation-id'] || uuidv4();

  // Agregar a request y response
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);

  // Agregar a locals para uso en otros middlewares
  res.locals.correlationId = correlationId;

  next();
}

module.exports = { correlationMiddleware };
