/**
 * @file stays.routes
 * @description Rutas de estadías con RBAC
 * @ref Pilar 7.1 (HTTP Interface)
 * @ref Pilar 4.1 (RBAC)
 */

import express from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { createStaysControllers } from '../controllers/stays.controllers.js';

/**
 * Crear router de estadías
 * @param {Object} services - { createStay, stayRepository, userRepository }
 * @returns {express.Router}
 */
const ADMIN_STAFF = ['admin', 'staff'];

function attachReadRoutes(router, { listStays, getStay }) {
  router.get('/', authenticate, listStays);
  router.get('/:id', authenticate, getStay);
}

function attachWriteRoutes(router, { createStayHandler, updateStay }) {
  router.post('/', authenticate, createStayHandler);
  router.put('/:id', authenticate, updateStay);
}

function attachAdminRoutes(router, { cancelStay, activateStay, completeStay }) {
  router.delete('/:id', authenticate, authorize(ADMIN_STAFF), cancelStay);
  router.post('/:id/activate', authenticate, authorize(ADMIN_STAFF), activateStay);
  router.post('/:id/complete', authenticate, authorize(ADMIN_STAFF), completeStay);
}

function attachReportsRoutes(router, { getOccupancy, getCheckpoints }) {
  router.get('/occupancy/:hotelCode', authenticate, authorize(ADMIN_STAFF), getOccupancy);
  router.get('/checkpoints/:hotelCode', authenticate, authorize(ADMIN_STAFF), getCheckpoints);
}

export function createStaysRoutes(services) {
  const router = express.Router();
  const { createStay, stayRepository, userRepository } = services;
  const controllers = createStaysControllers({ createStay, stayRepository, userRepository });
  attachReadRoutes(router, controllers);
  attachWriteRoutes(router, controllers);
  attachAdminRoutes(router, controllers);
  attachReportsRoutes(router, controllers);
  return router;
}

export default createStaysRoutes;
