import express from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

/**
 * Rutas HTTP para Vouchers
 * 6 endpoints con RBAC completo
 */
export function createVouchersRoutes({
  generateVoucher,
  validateVoucher,
  redeemVoucher,
  voucherRepository,
  logger,
}) {
  const router = express.Router();

  /**
   * POST /api/vouchers
   * Generar nuevo voucher
   * RBAC: Admin, Staff
   */
  router.post(
    '/',
    authenticate,
    authorize(['admin', 'staff']),
    async (req, res, next) => {
      try {
        const { stayId, expiryDays } = req.body;

        if (!stayId) {
          return res.status(400).json({ error: 'stayId requerido' });
        }

        const result = await generateVoucher.execute({
          stayId,
          expiryDays: expiryDays || 30,
        });

        res.status(201).json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/vouchers
   * Listar vouchers con paginación
   * RBAC: Admin, Staff
   */
  router.get(
    '/',
    authenticate,
    authorize(['admin', 'staff']),
    async (req, res, next) => {
      try {
        const { stayId, status, limit = 50, offset = 0 } = req.query;

        let vouchers;
        if (stayId) {
          vouchers = voucherRepository.findByStayId(stayId, limit, offset);
        } else if (status) {
          vouchers = voucherRepository.findByStatus(status, limit, offset);
        } else {
          vouchers = voucherRepository.findByStatus('active', limit, offset);
        }

        const stats = voucherRepository.getStats();

        res.json({
          data: vouchers,
          pagination: { limit: parseInt(limit), offset: parseInt(offset) },
          stats,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/vouchers/:id
   * Obtener un voucher específico
   * RBAC: Admin, Staff
   */
  router.get(
    '/:id',
    authenticate,
    authorize(['admin', 'staff']),
    async (req, res, next) => {
      try {
        const { id } = req.params;
        const voucher = voucherRepository.findById(id);

        if (!voucher) {
          return res.status(404).json({ error: 'Voucher no encontrado' });
        }

        res.json(voucher);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/vouchers/:code/validate
   * Validar un voucher
   * RBAC: Admin, Staff, CafeManager
   */
  router.post(
    '/:code/validate',
    authenticate,
    authorize(['admin', 'staff', 'cafemanager']),
    async (req, res, next) => {
      try {
        const { code } = req.params;
        const result = await validateVoucher.execute({ voucherCode: code });

        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/vouchers/:code/redeem
   * Canjear un voucher
   * RBAC: Admin, Staff, CafeManager
   */
  router.post(
    '/:code/redeem',
    authenticate,
    authorize(['admin', 'staff', 'cafemanager']),
    async (req, res, next) => {
      try {
        const { code } = req.params;
        const { notes } = req.body;

        const result = await redeemVoucher.execute({
          voucherCode: code,
          notes: notes || '',
        });

        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/vouchers/stats/overview
   * Obtener estadísticas de vouchers
   * RBAC: Admin, Staff
   */
  router.get(
    '/stats/overview',
    authenticate,
    authorize(['admin', 'staff']),
    async (req, res, next) => {
      try {
        const stats = voucherRepository.getStats();
        const expiringSoon = voucherRepository.findExpiringsSoon(3);

        res.json({
          stats,
          expiring_soon: expiringSoon.length,
          expiring_list: expiringSoon.slice(0, 10),
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
