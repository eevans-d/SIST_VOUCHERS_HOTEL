/**
 * @file stays.controllers.js
 * @description Controladores desacoplados para rutas de estadías.
 */

import {
  normalizeCheckInOut,
  ensureNumberOfGuests,
  calculateBasePrice,
  assignDefaultUser
} from './helpers/stays.helpers.js';

// Builders por handler (permiten granularidad y reducen tamaño de fábrica)
function buildListStays({ stayRepository }) {
  return async function listStays(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const offset = parseInt(req.query.offset) || 0;
      const status = req.query.status;
      const isPrivileged = req.user.role === 'admin' || req.user.role === 'staff';
      const stays = isPrivileged
        ? stayRepository.findAll({ status, limit, offset })
        : stayRepository.findByUserId(req.user.sub, { status, limit, offset });
      res.json(stays.map((s) => s.toJSON()));
    } catch (error) { next(error); }
  };
}

function buildGetStay({ stayRepository }) {
  return async function getStay(req, res, next) {
    try {
      const stay = stayRepository.findById(req.params.id);
      if (!stay) return res.status(404).json({ success: false, error: 'Estadía no encontrada' });
      const allowed = ['admin', 'staff'].includes(req.user.role) || stay.userId === req.user.sub;
      if (!allowed) return res.status(403).json({ success: false, error: 'No tienes permiso para ver esta estadía' });
      const payload = stay.toJSON();
      res.json({ success: true, data: payload, ...payload });
    } catch (error) { next(error); }
  };
}

function buildCreateStayHandler({ createStay, userRepository }) {
  return async function createStayHandler(req, res, next) {
    try {
      const input = { ...req.body };
      if (req.user.role === 'guest') input.userId = req.user.sub;

      normalizeCheckInOut(input);
      ensureNumberOfGuests(input);
      calculateBasePrice(input);
      assignDefaultUser(input, userRepository, req);

      const result = await createStay.execute(input);
      res.status(201).json({ success: true, data: result.stay, ...result.stay });
    } catch (error) {
      next(error);
    }
  };
}

function buildUpdateStay({ stayRepository }) {
  return async function updateStay(req, res, next) {
    try {
      const stay = stayRepository.findById(req.params.id);
      if (!stay) return res.status(404).json({ success: false, error: 'Estadía no encontrada' });
      const isOwner = stay.userId === req.user.sub;
      const isPrivileged = ['admin', 'staff'].includes(req.user.role);
      if (!isPrivileged && !isOwner) return res.status(403).json({ success: false, error: 'No tienes permiso para actualizar esta estadía' });
      if (req.user.role === 'guest' && stay.status !== 'pending') return res.status(403).json({ success: false, error: 'Solo puedes actualizar estadías pendientes' });
      const allowedFields = isPrivileged
        ? ['numberOfGuests', 'roomType', 'basePrice', 'totalPrice', 'status', 'notes']
        : ['numberOfGuests', 'notes'];
      const updates = {};
      for (const field of allowedFields) if (field in req.body) updates[field] = req.body[field];
      const updatedStay = stayRepository.update(req.params.id, updates);
      const payload = updatedStay.toJSON();
      res.json({ success: true, data: payload, ...payload, message: 'Estadía actualizada correctamente' });
    } catch (error) { next(error); }
  };
}

function buildCancelStay({ stayRepository }) {
  return async function cancelStay(req, res, next) {
    try {
      const stay = stayRepository.findById(req.params.id);
      if (!stay) return res.status(404).json({ success: false, error: 'Estadía no encontrada' });
      if (stay.isCompleted()) return res.status(400).json({ success: false, error: 'No se pueden cancelar estadías completadas' });
      const reason = req.body.reason || 'Cancelada por administrador';
      stay.cancel(reason);
      stayRepository.update(req.params.id, { status: stay.status, notes: stay.notes });
      res.json({ success: true, message: 'Estadía cancelada correctamente', data: stay.toJSON() });
    } catch (error) { next(error); }
  };
}

function buildActivateStay({ stayRepository }) {
  return async function activateStay(req, res, next) {
    try {
      const stay = stayRepository.findById(req.params.id);
      if (!stay) return res.status(404).json({ success: false, error: 'Estadía no encontrada' });
      stay.activate();
      stayRepository.update(req.params.id, { status: stay.status });
      const payload = stay.toJSON();
      res.json({ success: true, message: 'Estadía activada', data: payload, ...payload });
    } catch (error) { next(error); }
  };
}

function buildCompleteStay({ stayRepository }) {
  return async function completeStay(req, res, next) {
    try {
      const stay = stayRepository.findById(req.params.id);
      if (!stay) return res.status(404).json({ success: false, error: 'Estadía no encontrada' });
      stay.complete();
      stayRepository.update(req.params.id, { status: stay.status });
      const payload = stay.toJSON();
      res.json({ success: true, message: 'Estadía completada', data: payload, ...payload });
    } catch (error) { next(error); }
  };
}

function buildGetOccupancy({ stayRepository }) {
  return async function getOccupancy(req, res, next) {
    try {
      const date = req.query.date ? new Date(req.query.date) : new Date();
      const occupancy = stayRepository.getOccupancy(req.params.hotelCode, date);
      const totalRooms = Object.keys(occupancy).length || 0;
      const activeStays = totalRooms;
      const occupancyRate = totalRooms ? Math.round((activeStays / totalRooms) * 100) : 0;
      res.json({ occupancyRate, activeStays });
    } catch (error) { next(error); }
  };
}

function buildGetCheckpoints({ stayRepository }) {
  return async function getCheckpoints(req, res, next) {
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
    } catch (error) { next(error); }
  };
}

export function createStaysControllers(deps) {
  return {
    listStays: buildListStays(deps),
    getStay: buildGetStay(deps),
    createStayHandler: buildCreateStayHandler(deps),
    updateStay: buildUpdateStay(deps),
    cancelStay: buildCancelStay(deps),
    activateStay: buildActivateStay(deps),
    completeStay: buildCompleteStay(deps),
    getOccupancy: buildGetOccupancy(deps),
    getCheckpoints: buildGetCheckpoints(deps)
  };
}

export default createStaysControllers;
