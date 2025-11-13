import { ConflictError } from '../middleware/errorHandler.js';

/**
 * Valida estructura mínima de una redención offline.
 * Devuelve null si válida o un objeto de error si inválida.
 */
export function validateRedemptionStructure(redemption) {
  if (!redemption.local_id || !redemption.voucher_code) {
    return {
      local_id: redemption.local_id,
      status: 'error',
      reason: 'INVALID_STRUCTURE'
    };
  }
  return null;
}

/**
 * Inserta un registro en sync_log.
 */
export function insertSyncLog(db, { device_id, redemption, outcome }) {
  db
    .prepare(
      `INSERT INTO sync_log (device_id, operation, payload, result, synced_at)
       VALUES (?, 'redemption', ?, ?, datetime('now', 'localtime'))`
    )
    .run(device_id, JSON.stringify(redemption), outcome);
}

/**
 * Construye resultado de éxito.
 */
export function buildSuccessResult(redemption, redeemResponse) {
  return {
    local_id: redemption.local_id,
    status: 'synced',
    redemption_id: redeemResponse.redemption.redemption_id,
    server_timestamp: redeemResponse.redemption.redeemed_at
  };
}

/**
 * Construye resultado de conflicto.
 */
export function buildConflictResult(redemption, details) {
  return {
    local_id: redemption.local_id,
    status: 'conflict',
    reason: 'ALREADY_REDEEMED',
    server_timestamp: details.redeemed_at,
    cafeteria: details.cafeteria,
    device: details.device,
    local_timestamp: redemption.local_timestamp
  };
}

/**
 * Construye resultado de error genérico.
 */
export function buildErrorResult(redemption, error) {
  return {
    local_id: redemption.local_id,
    status: 'error',
    reason: error.message
  };
}

/**
 * Procesa una redención individual devolviendo estructura homogénea.
 */
export async function handleRedemption({ redemption, context }) {
  const { voucherService, db, device_id, correlation_id, user_id, logger } = context;
  const invalid = validateRedemptionStructure(redemption);
  if (invalid) return { result: invalid, counters: { success: 0, conflict: 0, error: 1 } };
  try {
    const redeemResponse = await voucherService.redeemVoucher({ code: redemption.voucher_code, cafeteria_id: redemption.cafeteria_id, device_id, correlation_id: `${correlation_id}-${redemption.local_id}`, user_id });
    insertSyncLog(db, { device_id, redemption, outcome: 'success' });
    return { result: buildSuccessResult(redemption, redeemResponse), counters: { success: 1, conflict: 0, error: 0 } };
  } catch (error) {
    if (error instanceof ConflictError) {
      logger.warn({ event: 'sync_conflict_detected', correlation_id, local_id: redemption.local_id, voucher_code: redemption.voucher_code, conflict_details: error.details });
      insertSyncLog(db, { device_id, redemption, outcome: 'conflict' });
      const conflictObj = buildConflictResult(redemption, error.details);
      return { result: conflictObj, conflict: conflictObj, counters: { success: 0, conflict: 1, error: 0 } };
    }
    logger.error({ event: 'sync_redemption_error', correlation_id, local_id: redemption.local_id, voucher_code: redemption.voucher_code, error: error.message });
    insertSyncLog(db, { device_id, redemption, outcome: 'error' });
    return { result: buildErrorResult(redemption, error), counters: { success: 0, conflict: 0, error: 1 } };
  }
}
