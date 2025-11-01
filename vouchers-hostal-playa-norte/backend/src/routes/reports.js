const express = require('express');
const { ReportService } = require('../services/reportService');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { ValidationError } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * GET /api/reports/redemptions
 * Reporte de canjes (CSV o JSON)
 */
router.get(
  '/redemptions',
  authMiddleware,
  requireRole('admin'),
  async (req, res, next) => {
    try {
      const { from, to, cafeteria_id, format } = req.query;

      if (!from || !to) {
        return next(new ValidationError('Parámetros from y to son requeridos'));
      }

      const result = await ReportService.generateRedemptionsCSV({
        from_date: from,
        to_date: to,
        cafeteria_id: cafeteria_id ? parseInt(cafeteria_id) : null,
        correlation_id: req.correlationId
      });

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="redemptions_${from}_${to}.csv"`
        );
        return res.send(result.csv);
      }

      res.json({
        success: true,
        data: result.csv,
        metadata: result.metadata
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/reports/reconciliation
 * Reporte de reconciliación (emitidos vs canjeados)
 */
router.get(
  '/reconciliation',
  authMiddleware,
  requireRole('admin'),
  async (req, res, next) => {
    try {
      const { from, to } = req.query;

      if (!from || !to) {
        return next(new ValidationError('Parámetros from y to son requeridos'));
      }

      const result = await ReportService.getReconciliationReport({
        from_date: from,
        to_date: to,
        correlation_id: req.correlationId
      });

      res.json({
        success: true,
        report: result
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/reports/metrics
 * Métricas operativas en tiempo real
 */
router.get(
  '/metrics',
  authMiddleware,
  requireRole('admin', 'reception'),
  async (req, res, next) => {
    try {
      const result = await ReportService.getOperationalMetrics({
        correlation_id: req.correlationId
      });

      res.json({
        success: true,
        metrics: result
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
