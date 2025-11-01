const express = require('express');
const { VoucherService } = require('../services/voucherService');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { validateLimiter, redeemLimiter } = require('../middleware/rateLimiter');
const { ValidationError } = require('../middleware/errorHandler');
const { z } = require('zod');

const router = express.Router();

// Schema de validación para emisión
const emitVouchersSchema = z.object({
  stay_id: z.number().int().positive(),
  valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  breakfast_count: z.number().int().min(1).max(30)
});

// Schema para validación
const validateVoucherSchema = z.object({
  code: z.string().regex(/^[A-Z]+-\d{4}-\d{4}$/),
  hmac: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional()
});

// Schema para canje
const redeemVoucherSchema = z.object({
  code: z.string().regex(/^[A-Z]+-\d{4}-\d{4}$/),
  cafeteria_id: z.number().int().positive(),
  device_id: z.string().min(1).max(100),
  local_timestamp: z.string().optional()
});

/**
 * POST /api/vouchers
 * Emitir nuevos vouchers
 */
router.post(
  '/',
  authMiddleware,
  requireRole('admin', 'reception'),
  async (req, res, next) => {
    try {
      // Validar input
      const data = emitVouchersSchema.parse(req.body);

      const result = await VoucherService.emitVouchers({
        ...data,
        correlation_id: req.correlationId,
        user_id: req.user.id
      });

      res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new ValidationError('Datos inválidos', error.errors));
      }
      next(error);
    }
  }
);

/**
 * GET /api/vouchers/:code
 * Obtener información de un voucher
 */
router.get('/:code', authMiddleware, async (req, res, next) => {
  try {
    const voucher = await VoucherService.getVoucher(
      req.params.code,
      req.correlationId
    );

    res.json({
      success: true,
      voucher
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/vouchers/validate
 * Validar voucher sin canjearlo
 */
router.post('/validate', validateLimiter, async (req, res, next) => {
  try {
    const data = validateVoucherSchema.parse(req.body);

    const result = await VoucherService.validateVoucher({
      ...data,
      correlation_id: req.correlationId
    });

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Datos inválidos', error.errors));
    }
    next(error);
  }
});

/**
 * POST /api/vouchers/redeem
 * Canjear voucher (transacción atómica)
 */
router.post(
  '/redeem',
  authMiddleware,
  requireRole('cafeteria'),
  redeemLimiter,
  async (req, res, next) => {
    try {
      const data = redeemVoucherSchema.parse(req.body);

      const result = await VoucherService.redeemVoucher({
        ...data,
        correlation_id: req.correlationId,
        user_id: req.user.id
      });

      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new ValidationError('Datos inválidos', error.errors));
      }
      next(error);
    }
  }
);

/**
 * POST /api/vouchers/:code/cancel
 * Cancelar voucher manualmente
 */
router.post(
  '/:code/cancel',
  authMiddleware,
  requireRole('admin'),
  async (req, res, next) => {
    try {
      const { reason } = req.body;

      const result = await VoucherService.cancelVoucher({
        code: req.params.code,
        reason: reason || 'Cancelación manual',
        correlation_id: req.correlationId,
        user_id: req.user.id
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
