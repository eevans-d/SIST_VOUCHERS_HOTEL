import express from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

function createVoucherRoutes(services) {
  const router = express.Router();
  const {
    generateVoucher,
    validateVoucher,
    redeemVoucher,
    voucherRepository
  } =
    services;

  // Compatibilidad E2E: crear voucher con POST /
  router.post(
    '/',
    authenticate,
    authorize(['admin', 'staff', 'reception']),
    async (req, res, next) => {
      try {
        const { stayId } = req.body || {};
        // Por defecto 1 voucher
        const vouchers = await generateVoucher.execute({
          stayId,
          numberOfVouchers: 1
        });
        const voucher = Array.isArray(vouchers) ? vouchers[0] : vouchers;
        res.status(201).json(voucher);
      } catch (error) {
        next(error);
      }
    }
  );

  // Compatibilidad E2E: listar vouchers
  router.get(
    '/',
    authenticate,
    authorize(['admin', 'staff', 'cafemanager']),
    async (req, res, next) => {
      try {
        const { status, limit = 50, offset = 0 } = req.query;
        const list = status
          ? voucherRepository.findByStatus(status, parseInt(limit), parseInt(offset))
          : voucherRepository.findByDateRange('1970-01-01', new Date().toISOString(), parseInt(limit), parseInt(offset));
        res.json(list.map((v) => v.toJSON ? v.toJSON() : v));
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/:code/validate',
    authenticate,
    authorize(['cafeteria', 'admin']),
    async (req, res, next) => {
      try {
        const { code } = req.params;
        const result = await validateVoucher.execute({ voucherCode: code });
        // Respuesta compatible con spec E2E
        if (!result.valid) {
          return res.status(400).json({ success: false, error: result.error });
        }
        res.json({ status: 'active', ...result });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/:code/redeem',
    authenticate,
    authorize(['cafeteria', 'admin']),
    async (req, res, next) => {
      try {
        const { code } = req.params;
        const result = await redeemVoucher.execute({ voucherCode: code });
        res.json({ status: result.status, ...result });
      } catch (error) {
        next(error);
      }
    }
  );

  // Compatibilidad E2E: estadísticas overview
  router.get(
    '/stats/overview',
    authenticate,
    authorize(['admin', 'staff']),
    async (req, res, next) => {
      try {
        const stats = voucherRepository.getStats();
        res.json({
          totalGenerated: stats.total,
          byStatus: {
            pending: stats.pending,
            active: stats.active,
            redeemed: stats.redeemed,
            expired: stats.expired,
            cancelled: stats.cancelled
          },
          redemptionRate: stats.redemptionRate
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

export default createVoucherRoutes;
