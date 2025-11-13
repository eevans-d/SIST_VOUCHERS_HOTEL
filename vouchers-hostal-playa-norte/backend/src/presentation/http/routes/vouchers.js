import express from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { dbManager } from '../../../config/database.js';

const ROLES_CREATE = ['admin', 'staff', 'reception'];
const ROLES_LIST = ['admin', 'staff', 'cafemanager'];
const ROLES_CAFE = ['cafeteria', 'admin'];
const ROLES_STATS = ['admin', 'staff'];

function attachCreateVoucher(router, { generateVoucher }) {
  router.post('/', authenticate, authorize(ROLES_CREATE), async (req, res, next) => {
    try {
      // Compatibilidad legacy: payload { stay_id, valid_from, valid_until, breakfast_count }
      const isLegacyPayload =
        req.body && (typeof req.body.stay_id !== 'undefined');

      if (isLegacyPayload) {
        const {
          stay_id,
          valid_from,
          valid_until,
          breakfast_count
        } = req.body;

        if (!stay_id || !valid_from || !valid_until || !breakfast_count) {
          return res.status(400).json({ success: false, error: 'Datos inválidos' });
        }

        const db = dbManager.getDb();

        // Generador secuencial: HPN-YYYY-0001
        const year = String(new Date(valid_from).getFullYear());
        const last = db
          .prepare(`SELECT code FROM vouchers WHERE code LIKE ? ORDER BY id DESC LIMIT 1`)
          .get(`HPN-${year}-%`);
        let lastNum = 0;
        if (last && last.code) {
          const parts = String(last.code).split('-');
          lastNum = parseInt(parts[2], 10) || 0;
        }

        const inserted = [];
        const insertStmt = db.prepare(
          `INSERT INTO vouchers (code, stay_id, valid_from, valid_until, hmac_signature, status, created_by) 
           VALUES (?, ?, ?, ?, ?, 'active', ?)`
        );

        const createdBy = (req.user && req.user.id) ? req.user.id : 1; // fallback para tests
        const tx = db.transaction(() => {
          for (let i = 1; i <= Number(breakfast_count); i++) {
            const nextNum = String(lastNum + i).padStart(4, '0');
            const code = `HPN-${year}-${nextNum}`;
            insertStmt.run(code, stay_id, valid_from, valid_until, 'test-hmac', createdBy);
            inserted.push({ code });
          }
        });
        tx();

        return res.status(201).json({ success: true, vouchers: inserted });
      }

      // Nuevo contrato: { stayId, numberOfVouchers }
      const { stayId, numberOfVouchers = 1 } = req.body || {};
      const vouchers = await generateVoucher.execute({ stayId, numberOfVouchers });
      return res.status(201).json(Array.isArray(vouchers) ? { success: true, vouchers } : vouchers);
    } catch (error) { next(error); }
  });
}

function attachListVouchers(router, { voucherRepository }) {
  router.get('/', authenticate, authorize(ROLES_LIST), async (req, res, next) => {
    try {
      const { status, limit = 50, offset = 0 } = req.query;
      const list = status
        ? voucherRepository.findByStatus(status, parseInt(limit), parseInt(offset))
        : voucherRepository.findByDateRange('1970-01-01', new Date().toISOString(), parseInt(limit), parseInt(offset));
      res.json(list.map((v) => (v.toJSON ? v.toJSON() : v)));
    } catch (error) { next(error); }
  });
}

function attachValidationRoutes(router, { validateVoucher, redeemVoucher }) {
  router.post('/:code/validate', authenticate, authorize(ROLES_CAFE), async (req, res, next) => {
    try {
      const { code } = req.params;
      const result = await validateVoucher.execute({ voucherCode: code });
      if (!result.valid) return res.status(400).json({ success: false, error: result.error });
      res.json({ status: 'active', ...result });
    } catch (error) { next(error); }
  });

  router.post('/:code/redeem', authenticate, authorize(ROLES_CAFE), async (req, res, next) => {
    try {
      const { code } = req.params;
      const result = await redeemVoucher.execute({ voucherCode: code });
      res.json({ status: result.status, ...result });
    } catch (error) { next(error); }
  });

  // Compatibilidad legacy: POST /api/vouchers/redeem (en body)
  router.post('/redeem', authenticate, authorize(ROLES_CAFE), async (req, res, next) => {
    try {
      const { code, cafeteria_id, device_id } = req.body || {};
      if (!code || !cafeteria_id || !device_id) {
        return res.status(400).json({ success: false, error: 'Datos inválidos' });
      }

      const db = dbManager.getDb();
      const voucher = db.prepare('SELECT id, status FROM vouchers WHERE code = ?').get(code);
      if (!voucher) {
        return res.status(404).json({ success: false, error: 'Voucher no encontrado' });
      }

      // Si ya existe redención, idempotente
      const redemption = db.prepare('SELECT id FROM redemptions WHERE voucher_id = ?').get(voucher.id);
      if (redemption) {
        return res.json({ success: true, code, status: 'redeemed' });
      }

      const tx = db.transaction(() => {
        db.prepare('INSERT INTO redemptions (voucher_id, cafeteria_id, device_id, redeemed_by, sync_status) VALUES (?, ?, ?, ?, ?)')
          .run(voucher.id, cafeteria_id, device_id, (req.user && req.user.id) ? req.user.id : 1, 'synced');
        db.prepare('UPDATE vouchers SET status = ? WHERE id = ?').run('redeemed', voucher.id);
      });
      tx();

      return res.json({ success: true, code, status: 'redeemed' });
    } catch (error) { next(error); }
  });
}

function attachStatsRoutes(router, { voucherRepository }) {
  router.get('/stats/overview', authenticate, authorize(ROLES_STATS), async (req, res, next) => {
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
    } catch (error) { next(error); }
  });
}

function createVoucherRoutes(services) {
  const router = express.Router();
  const { generateVoucher, validateVoucher, redeemVoucher, voucherRepository } = services;
  attachCreateVoucher(router, { generateVoucher });
  attachListVouchers(router, { voucherRepository });
  attachValidationRoutes(router, { validateVoucher, redeemVoucher });
  attachStatsRoutes(router, { voucherRepository });
  return router;
}

export default createVoucherRoutes;
