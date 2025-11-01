/**
 * @file stays.routes
 * @description Rutas de estadías con RBAC
 * @ref Pilar 7.1 (HTTP Interface)
 * @ref Pilar 4.1 (RBAC)
 */

import express from 'express';
import { authenticateToken, authorizeRole } from './auth.js';

/**
 * Crear router de estadías
 * @param {Object} services - { createStay, stayRepository, userRepository }
 * @returns {express.Router}
 */
export function createStaysRoutes(services) {
  const router = express.Router();

  const { createStay, stayRepository, userRepository } = services;

  /**
   * GET /api/stays
   * Listar estadías (filtradas según rol)
   * - Admin: ve todas
   * - Guest: ve solo las suyas
   */
  router.get('/', authenticateToken, (req, res, next) => {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const offset = parseInt(req.query.offset) || 0;
      const status = req.query.status;

      let stays;
      let total;

      if (req.user.role === 'admin' || req.user.role === 'staff') {
        // Admin/staff ve todas las estadías
        stays = stayRepository.findAll({
          status,
          limit,
          offset
        });
        total = stayRepository.countByStatus(status || 'active');
      } else {
        // Guest solo ve las suyas
        stays = stayRepository.findByUserId(req.user.sub, {
          status,
          limit,
          offset
        });
        total = stayRepository.findByUserId(req.user.sub).length;
      }

      res.json({
        success: true,
        data: stays.map((s) => s.toJSON()),
        pagination: { limit, offset, total }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/stays/:id
   * Obtener estadía por ID
   */
  router.get('/:id', authenticateToken, (req, res, next) => {
    try {
      const stay = stayRepository.findById(req.params.id);

      if (!stay) {
        return res.status(404).json({
          success: false,
          error: 'Estadía no encontrada'
        });
      }

      // Verificar permisos
      if (
        req.user.role !== 'admin' &&
        req.user.role !== 'staff' &&
        stay.userId !== req.user.sub
      ) {
        return res.status(403).json({
          success: false,
          error: 'No tienes permiso para ver esta estadía'
        });
      }

      res.json({
        success: true,
        data: stay.toJSON()
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/stays
   * Crear nueva estadía
   * - Solo admin/staff pueden crear para otros
   * - Guests crean solo para sí mismos
   */
  router.post('/', authenticateToken, async (req, res, next) => {
    try {
      const input = { ...req.body };

      // Si es guest, forzar que sea para sí mismo
      if (req.user.role === 'guest') {
        input.userId = req.user.sub;
      }

      const result = await createStay.execute(input);

      res.status(201).json({
        success: true,
        data: result.stay,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /api/stays/:id
   * Actualizar estadía
   * - Admin/staff pueden actualizar cualquiera
   * - Guest solo puede actualizar las suyas (si están pending)
   */
  router.put('/:id', authenticateToken, (req, res, next) => {
    try {
      const stay = stayRepository.findById(req.params.id);

      if (!stay) {
        return res.status(404).json({
          success: false,
          error: 'Estadía no encontrada'
        });
      }

      // Verificar permisos
      if (req.user.role === 'guest' && stay.userId !== req.user.sub) {
        return res.status(403).json({
          success: false,
          error: 'No tienes permiso para actualizar esta estadía'
        });
      }

      // Guests solo pueden actualizar si está pending
      if (req.user.role === 'guest' && stay.status !== 'pending') {
        return res.status(403).json({
          success: false,
          error: 'Solo puedes actualizar estadías pendientes'
        });
      }

      // Filtrar campos actualizables
      const allowedFields =
        req.user.role === 'admin'
          ? [
            'numberOfGuests',
            'roomType',
            'basePrice',
            'totalPrice',
            'status',
            'notes'
          ]
          : ['numberOfGuests', 'notes']; // Guests solo notas

      const updates = {};
      allowedFields.forEach((field) => {
        if (field in req.body) {
          updates[field] = req.body[field];
        }
      });

      const updatedStay = stayRepository.update(req.params.id, updates);

      res.json({
        success: true,
        data: updatedStay.toJSON(),
        message: 'Estadía actualizada correctamente'
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /api/stays/:id
   * Eliminar/Cancelar estadía
   * - Solo admin/staff
   */
  router.delete(
    '/:id',
    authenticateToken,
    authorizeRole(['admin', 'staff']),
    (req, res, next) => {
      try {
        const stay = stayRepository.findById(req.params.id);

        if (!stay) {
          return res.status(404).json({
            success: false,
            error: 'Estadía no encontrada'
          });
        }

        if (stay.isCompleted()) {
          return res.status(400).json({
            success: false,
            error: 'No se pueden cancelar estadías completadas'
          });
        }

        const reason = req.body.reason || 'Cancelada por administrador';
        stay.cancel(reason);
        stayRepository.update(req.params.id, {
          status: stay.status,
          notes: stay.notes
        });

        res.json({
          success: true,
          message: 'Estadía cancelada correctamente',
          data: stay.toJSON()
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/stays/:id/activate
   * Activar estadía (cambiar de pending a active)
   * - Solo admin/staff
   */
  router.post(
    '/:id/activate',
    authenticateToken,
    authorizeRole(['admin', 'staff']),
    (req, res, next) => {
      try {
        const stay = stayRepository.findById(req.params.id);

        if (!stay) {
          return res.status(404).json({
            success: false,
            error: 'Estadía no encontrada'
          });
        }

        stay.activate();
        stayRepository.update(req.params.id, { status: stay.status });

        res.json({
          success: true,
          message: 'Estadía activada',
          data: stay.toJSON()
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/stays/:id/complete
   * Completar estadía (cambiar a completed)
   * - Solo admin/staff
   */
  router.post(
    '/:id/complete',
    authenticateToken,
    authorizeRole(['admin', 'staff']),
    (req, res, next) => {
      try {
        const stay = stayRepository.findById(req.params.id);

        if (!stay) {
          return res.status(404).json({
            success: false,
            error: 'Estadía no encontrada'
          });
        }

        stay.complete();
        stayRepository.update(req.params.id, { status: stay.status });

        res.json({
          success: true,
          message: 'Estadía completada',
          data: stay.toJSON()
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/stays/occupancy/:hotelCode
   * Obtener ocupación de hotel para una fecha
   * - Solo admin/staff
   */
  router.get(
    '/occupancy/:hotelCode',
    authenticateToken,
    authorizeRole(['admin', 'staff']),
    (req, res, next) => {
      try {
        const date = req.query.date ? new Date(req.query.date) : new Date();
        const occupancy = stayRepository.getOccupancy(
          req.params.hotelCode,
          date
        );

        res.json({
          success: true,
          data: {
            date: date.toISOString().split('T')[0],
            hotelCode: req.params.hotelCode,
            occupancy
          }
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/stays/checkpoints/:hotelCode
   * Obtener check-ins/check-outs de hoy
   * - Solo admin/staff
   */
  router.get(
    '/checkpoints/:hotelCode',
    authenticateToken,
    authorizeRole(['admin', 'staff']),
    (req, res, next) => {
      try {
        const stays = stayRepository.findTodayCheckpoints(req.params.hotelCode);

        const checkIns = stays.filter((s) => s.isCheckInToday());
        const checkOuts = stays.filter((s) => s.isCheckOutToday());

        res.json({
          success: true,
          data: {
            date: new Date().toISOString().split('T')[0],
            checkIns: checkIns.map((s) => s.toJSON()),
            checkOuts: checkOuts.map((s) => s.toJSON())
          }
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

export default createStaysRoutes;
