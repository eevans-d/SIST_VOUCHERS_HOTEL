import express from 'express';
import { authenticateToken, authorizeRole } from './auth.js';

function createVoucherRoutes(services) {
  const router = express.Router();
  const { generateVoucher, validateVoucher, redeemVoucher, jwtService } =
    services;

  router.post(
    '/generate',
    authenticateToken(jwtService),
    authorizeRole(['admin', 'reception']),
    async (req, res, next) => {
      try {
        const result = await generateVoucher.execute(req.body);
        res.status(201).json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/validate',
    authenticateToken(jwtService),
    authorizeRole(['cafeteria']),
    async (req, res, next) => {
      try {
        const result = await validateVoucher.execute(req.body);
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/redeem',
    authenticateToken(jwtService),
    authorizeRole(['cafeteria']),
    async (req, res, next) => {
      try {
        const result = await redeemVoucher.execute(req.body);
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

export default createVoucherRoutes;
