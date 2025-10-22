const express = require('express');

/**
 * Crea router de vouchers
 * 
 * Endpoints:
 * GET    /api/vouchers              - Listar vouchers (admin/staff)
 * GET    /api/vouchers/:id          - Obtener voucher con QR
 * POST   /api/vouchers              - Generar nuevo voucher
 * POST   /api/vouchers/:code/validate - Validar voucher
 * POST   /api/vouchers/:code/redeem - Canjear voucher
 * GET    /api/vouchers/stats/overview - Estadísticas de vouchers
 * 
 * RBAC:
 * - Admin/Staff: Acceso total
 * - CafeManager: Puede validar/canjear
 * - Guest: No tiene acceso
 * 
 * @param {Object} services - Servicios inyectados
 * @param {VoucherRepository} services.voucherRepository
 * @param {StayRepository} services.stayRepository
 * @param {GenerateVoucher} services.generateVoucher
 * @param {ValidateVoucher} services.validateVoucher
 * @param {RedeemVoucher} services.redeemVoucher
 * @param {QRService} services.qrService
 * @param {Logger} services.logger
 * @returns {express.Router} Router configurado
 */
function createVouchersRoutes(services) {
  const router = express.Router();

  const {
    voucherRepository,
    stayRepository,
    generateVoucher,
    validateVoucher,
    redeemVoucher,
    qrService,
    logger,
  } = services;

  /**
   * GET /api/vouchers
   * Listar todos los vouchers (con paginación y filtros)
   * 
   * Query params:
   * - status: 'pending|active|redeemed|expired|cancelled'
   * - page: número de página (default: 1)
   * - limit: cantidad por página (default: 20, max: 100)
   * - sortBy: 'createdAt|expiryDate' (default: createdAt)
   * - order: 'asc|desc' (default: desc)
   * 
   * Respuesta:
   * {
   *   vouchers: Voucher[],
   *   pagination: {page, limit, total, pages},
   *   filters: {status, sortBy, order}
   * }
   */
  router.get('/api/vouchers', (req, res) => {
    try {
      // RBAC: Solo admin y staff
      if (!['admin', 'staff'].includes(req.user?.role)) {
        return res.status(403).json({
          error: 'No autorizado para listar vouchers',
        });
      }

      const { status, page = 1, limit = 20, sortBy = 'createdAt', order = 'desc' } = req.query;

      // Validar limit máximo
      const finalLimit = Math.min(parseInt(limit) || 20, 100);
      const offset = (parseInt(page) - 1) * finalLimit;

      // Obtener vouchers
      let result;
      if (status) {
        result = voucherRepository.findByStatus(status, finalLimit, offset);
      } else {
        // Obtener todos (con paginación manual si es necesario)
        const allVouchers = voucherRepository.findByStatus('pending', 999999, 0);
        result = {
          vouchers: allVouchers.vouchers.slice(offset, offset + finalLimit),
          total: allVouchers.total,
        };
      }

      res.json({
        vouchers: result.vouchers.map((v) => v.toJSON()),
        pagination: {
          page: parseInt(page),
          limit: finalLimit,
          total: result.total,
          pages: Math.ceil(result.total / finalLimit),
        },
        filters: { status: status || 'all', sortBy, order },
      });
    } catch (error) {
      logger.error('Error listando vouchers', { error: error.message });
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  /**
   * GET /api/vouchers/:id
   * Obtener un voucher específico con QR
   * 
   * Response:
   * {
   *   voucher: Voucher,
   *   qr: {text, url, dataUrl},
   *   stay: Stay (info del huésped)
   * }
   */
  router.get('/api/vouchers/:id', (req, res) => {
    try {
      // RBAC: Solo admin y staff
      if (!['admin', 'staff'].includes(req.user?.role)) {
        return res.status(403).json({
          error: 'No autorizado',
        });
      }

      const { id } = req.params;
      const voucher = voucherRepository.findById(id);

      if (!voucher) {
        return res.status(404).json({ error: 'Voucher no encontrado' });
      }

      const stay = stayRepository.findById(voucher.stayId);
      const qr = qrService.generateQR(voucher);

      res.json({
        voucher: voucher.toJSON(),
        qr,
        stay: stay?.toJSON(),
      });
    } catch (error) {
      logger.error('Error obteniendo voucher', { error: error.message });
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  /**
   * POST /api/vouchers
   * Generar nuevo voucher para una estadía
   * 
   * Body:
   * {
   *   stayId: string (UUID),
   *   expiryDate?: Date (default: hoy + 30 días)
   * }
   * 
   * Response:
   * {
   *   success: boolean,
   *   voucher: Voucher,
   *   qr: {text, url}
   * }
   */
  router.post('/api/vouchers', (req, res) => {
    try {
      // RBAC: Solo admin y staff pueden generar
      if (!['admin', 'staff'].includes(req.user?.role)) {
        return res.status(403).json({
          error: 'No autorizado para generar vouchers',
        });
      }

      const { stayId, expiryDate } = req.body;

      const result = generateVoucher.execute({
        stayId,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
        requestedBy: req.user.email,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      const qr = qrService.generateQR(result.data);

      res.status(201).json({
        success: true,
        voucher: result.data.toJSON(),
        qr,
      });
    } catch (error) {
      logger.error('Error generando voucher', { error: error.message });
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  /**
   * POST /api/vouchers/:code/validate
   * Validar que un voucher puede ser canjeado
   * 
   * Response:
   * {
   *   valid: boolean,
   *   voucher?: Voucher,
   *   stay?: Stay,
   *   errors?: string[]
   * }
   */
  router.post('/api/vouchers/:code/validate', (req, res) => {
    try {
      // RBAC: Admin, staff, cafe_manager
      if (!['admin', 'staff', 'cafe_manager'].includes(req.user?.role)) {
        return res.status(403).json({
          error: 'No autorizado',
        });
      }

      const { code } = req.params;

      const result = validateVoucher.execute({
        code,
        validatedBy: req.user.email,
      });

      res.json({
        valid: result.valid,
        voucher: result.voucher?.toJSON(),
        stay: result.stay?.toJSON(),
        errors: result.errors,
      });
    } catch (error) {
      logger.error('Error validando voucher', { error: error.message });
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  /**
   * POST /api/vouchers/:code/redeem
   * Canjear un voucher
   * 
   * Body:
   * {
   *   notes?: string (ej: "2 cafés, 1 pastel")
   * }
   * 
   * Response:
   * {
   *   success: boolean,
   *   voucher: Voucher,
   *   stay: Stay,
   *   message: string
   * }
   */
  router.post('/api/vouchers/:code/redeem', (req, res) => {
    try {
      // RBAC: Admin, staff, cafe_manager
      if (!['admin', 'staff', 'cafe_manager'].includes(req.user?.role)) {
        return res.status(403).json({
          error: 'No autorizado para canjear vouchers',
        });
      }

      const { code } = req.params;
      const { notes } = req.body;

      const result = redeemVoucher.execute({
        code,
        notes,
        redeemedBy: req.user.email,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({
        success: true,
        voucher: result.data.toJSON(),
        stay: result.stay?.toJSON(),
        message: `Voucher ${code} canjeado exitosamente`,
      });
    } catch (error) {
      logger.error('Error canjeando voucher', { error: error.message });
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  /**
   * GET /api/vouchers/stats/overview
   * Obtener estadísticas generales de vouchers
   * 
   * Response:
   * {
   *   stats: {total, pending, active, redeemed, expired, cancelled, redemptionRate},
   *   expiringSoon: Voucher[],
   *   recentlyRedeemed: Voucher[]
   * }
   */
  router.get('/api/vouchers/stats/overview', (req, res) => {
    try {
      // RBAC: Solo admin y staff
      if (!['admin', 'staff'].includes(req.user?.role)) {
        return res.status(403).json({
          error: 'No autorizado',
        });
      }

      const stats = voucherRepository.getStats();
      const expiringSoon = voucherRepository.findExpiringsoon();
      const recentlyRedeemed = voucherRepository.findRedeemedByDate(new Date());

      res.json({
        stats,
        expiringSoon: expiringSoon.map((v) => v.toJSON()),
        recentlyRedeemed: recentlyRedeemed.map((v) => v.toJSON()),
      });
    } catch (error) {
      logger.error('Error obteniendo estadísticas', { error: error.message });
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  /**
   * POST /api/vouchers/:stayId/batch-generate
   * Generar múltiples vouchers para una estadía (para combos)
   * 
   * Body:
   * {
   *   quantity: number (2-10),
   *   expiryDate?: Date
   * }
   * 
   * Response:
   * {
   *   success: boolean,
   *   vouchers: Voucher[],
   *   qrs: {text, url}[]
   * }
   */
  router.post('/api/vouchers/:stayId/batch-generate', (req, res) => {
    try {
      // RBAC: Solo admin y staff
      if (!['admin', 'staff'].includes(req.user?.role)) {
        return res.status(403).json({
          error: 'No autorizado',
        });
      }

      const { stayId } = req.params;
      const { quantity = 1, expiryDate } = req.body;

      // Validar cantidad
      if (quantity < 1 || quantity > 10) {
        return res.status(400).json({
          error: 'La cantidad debe estar entre 1 y 10',
        });
      }

      const vouchers = [];
      const qrs = [];

      for (let i = 0; i < quantity; i++) {
        const result = generateVoucher.execute({
          stayId,
          expiryDate: expiryDate ? new Date(expiryDate) : undefined,
          requestedBy: req.user.email,
        });

        if (result.success) {
          vouchers.push(result.data);
          qrs.push(qrService.generateQR(result.data));
        }
      }

      res.status(201).json({
        success: vouchers.length === quantity,
        vouchers: vouchers.map((v) => v.toJSON()),
        qrs,
        generated: vouchers.length,
        requested: quantity,
      });
    } catch (error) {
      logger.error('Error generando lote de vouchers', { error: error.message });
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  return router;
}

module.exports = createVouchersRoutes;
