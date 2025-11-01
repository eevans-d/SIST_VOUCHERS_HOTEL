const express = require('express');
const { SyncService } = require('../services/syncService');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { syncLimiter } = require('../middleware/rateLimiter');
const { ValidationError } = require('../middleware/errorHandler');
const { z } = require('zod');

const router = express.Router();

// Schema para sincronización
const syncRedemptionsSchema = z.object({
  device_id: z.string().min(1).max(100),
  redemptions: z
    .array(
      z.object({
        local_id: z.string(),
        voucher_code: z.string().regex(/^[A-Z]+-\d{4}-\d{4}$/),
        cafeteria_id: z.number().int().positive(),
        local_timestamp: z.string()
      })
    )
    .min(1)
    .max(50) // Máximo 50 canjes por batch
});

/**
 * POST /api/sync/redemptions
 * Sincronizar canjes offline
 */
router.post(
  '/redemptions',
  authMiddleware,
  requireRole('cafeteria'),
  syncLimiter,
  async (req, res, next) => {
    try {
      const data = syncRedemptionsSchema.parse(req.body);

      const result = await SyncService.syncRedemptions({
        ...data,
        correlation_id: req.correlationId,
        user_id: req.user.id
      });

      // Si hay conflictos, usar status 207 (Multi-Status)
      const statusCode =
        result.conflicts && result.conflicts.length > 0 ? 207 : 200;

      res.status(statusCode).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new ValidationError('Datos inválidos', error.errors));
      }
      next(error);
    }
  }
);

/**
 * GET /api/sync/history
 * Obtener historial de sincronización
 */
router.get(
  '/history',
  authMiddleware,
  requireRole('cafeteria', 'admin'),
  async (req, res, next) => {
    try {
      const { device_id, limit } = req.query;

      if (!device_id) {
        return next(new ValidationError('device_id es requerido'));
      }

      const result = await SyncService.getSyncHistory({
        device_id,
        limit: limit ? parseInt(limit) : 100,
        correlation_id: req.correlationId
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/sync/stats
 * Obtener estadísticas de sincronización
 */
router.get(
  '/stats',
  authMiddleware,
  requireRole('cafeteria', 'admin'),
  async (req, res, next) => {
    try {
      const { device_id, from_date, to_date } = req.query;

      if (!device_id) {
        return next(new ValidationError('device_id es requerido'));
      }

      const result = await SyncService.getSyncStats({
        device_id,
        from_date,
        to_date,
        correlation_id: req.correlationId
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
