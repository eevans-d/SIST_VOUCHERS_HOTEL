// SyncService REAL Coverage Tests con ES Modules
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mocks antes de importar
jest.unstable_mockModule('../../../src/config/database.js', () => ({
  getDb: jest.fn()
}));

jest.unstable_mockModule('../../../src/config/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  auditLogger: { info: jest.fn() }
}));

jest.unstable_mockModule('../../../src/services/voucherService.js', () => ({
  voucherService: {
    redeemVoucher: jest.fn()
  }
}));

jest.unstable_mockModule('../../../src/middleware/errorHandler.js', () => ({
  ConflictError: class ConflictError extends Error {
    constructor(message, details) { super(message); this.details = details; }
  }
}));

describe('SyncService - Real Coverage', () => {
  let syncService, getDb, mockDb, ConflictError;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Cargar módulos mockeados
    const dbMod = await import('../../../src/config/database.js');
    const loggerMod = await import('../../../src/config/logger.js');
    const voucherMod = await import('../../../src/services/voucherService.js');
    const errorsMod = await import('../../../src/middleware/errorHandler.js');

    getDb = dbMod.getDb;
    ConflictError = errorsMod.ConflictError;

    // Configurar DB mock
    const prep = {
      run: jest.fn().mockReturnValue({ lastInsertRowid: 1 }),
      all: jest.fn().mockReturnValue([])
    };
    mockDb = { prepare: jest.fn().mockReturnValue(prep) };
    getDb.mockReturnValue(mockDb);

    // Importar SyncService real (post-mocks)
    const mod = await import('../../../src/services/syncService.js');
    syncService = mod.syncService;

    // Atajos
    syncService.__test = { logger: loggerMod.logger, auditLogger: loggerMod.auditLogger, voucherService: voucherMod.voucherService };
  });

  it('debe sincronizar un canje exitoso', async () => {
    const { voucherService } = syncService.__test;
    voucherService.redeemVoucher.mockResolvedValue({
      redemption: { redemption_id: 123, redeemed_at: '2025-11-01 10:00:00' }
    });

    const input = {
      device_id: 'dev-1',
      correlation_id: 'c-1',
      user_id: 7,
      redemptions: [
        { local_id: 'loc-1', voucher_code: 'HOTEL-2025-0001', cafeteria_id: 5, local_timestamp: '2025-11-01 09:59:00' }
      ]
    };

    const res = await syncService.syncRedemptions(input);

    expect(res.success).toBe(true);
    expect(res.summary).toEqual({ total: 1, synced: 1, conflicts: 0, errors: 0 });
    expect(res.results[0]).toMatchObject({ local_id: 'loc-1', status: 'synced' });
    // Se registra en sync_log
    expect(mockDb.prepare).toHaveBeenCalled();
  });

  it('debe registrar estructura inválida sin llamar a redeemVoucher', async () => {
    const { voucherService } = syncService.__test;

    const input = {
      device_id: 'dev-1', correlation_id: 'c-2', user_id: 7,
      redemptions: [ { local_id: null, cafeteria_id: 5 } ] // falta voucher_code y local_id inválido
    };

    const res = await syncService.syncRedemptions(input);

    expect(res.summary.errors).toBe(1);
    expect(res.results[0]).toMatchObject({ status: 'error', reason: 'INVALID_STRUCTURE' });
    expect(voucherService.redeemVoucher).not.toHaveBeenCalled();
  });

  it('debe manejar conflicto (voucher ya canjeado)', async () => {
    const { voucherService } = syncService.__test;
    const conflict = new ConflictError('ALREADY_REDEEMED', {
      redeemed_at: '2025-11-01 09:00:00', cafeteria: 'Main', device: 'term-3'
    });
    voucherService.redeemVoucher.mockRejectedValue(conflict);

    const input = {
      device_id: 'dev-1', correlation_id: 'c-3', user_id: 7,
      redemptions: [ { local_id: 'loc-2', voucher_code: 'HOTEL-2025-0002', cafeteria_id: 5, local_timestamp: '2025-11-01 09:10:00' } ]
    };

    const res = await syncService.syncRedemptions(input);

    expect(res.summary.conflicts).toBe(1);
    expect(res.results[0]).toMatchObject({ status: 'conflict', reason: 'ALREADY_REDEEMED' });
  });

  it('debe manejar error genérico en redeemVoucher', async () => {
    const { voucherService } = syncService.__test;
    voucherService.redeemVoucher.mockRejectedValue(new Error('DB_DOWN'));

    const input = {
      device_id: 'dev-1', correlation_id: 'c-4', user_id: 7,
      redemptions: [ { local_id: 'loc-3', voucher_code: 'HOTEL-2025-0003', cafeteria_id: 5 } ]
    };

    const res = await syncService.syncRedemptions(input);

    expect(res.summary.errors).toBe(1);
    expect(res.results[0]).toMatchObject({ status: 'error', reason: 'DB_DOWN' });
  });

  it('getSyncHistory debe parsear payloads', async () => {
    const rows = [
      { device_id: 'dev-1', payload: JSON.stringify({ a: 1 }), synced_at: '2025-11-01 10:00:00' }
    ];
    const prepCustom = { all: jest.fn().mockReturnValue(rows) };
    mockDb.prepare.mockReturnValueOnce(prepCustom);

    const res = await syncService.getSyncHistory({ device_id: 'dev-1', limit: 10 });
    expect(res.device_id).toBe('dev-1');
    expect(res.history[0].payload).toEqual({ a: 1 });
  });

  it('getSyncStats debe aceptar filtros from/to', async () => {
    // Simular ejecución devolviendo conteos agrupados
    const prepCustom = { all: jest.fn().mockReturnValue([
      { result: 'success', count: 3, sync_date: '2025-11-01' },
      { result: 'conflict', count: 1, sync_date: '2025-11-01' }
    ]) };
    mockDb.prepare.mockReturnValueOnce(prepCustom);

    const res = await syncService.getSyncStats({ device_id: 'dev-1', from_date: '2025-11-01', to_date: '2025-11-02' });
    expect(res.stats.length).toBe(2);
    expect(res.period).toEqual({ from: '2025-11-01', to: '2025-11-02' });
  });

  it('getSyncStats sin filtros debe construir query base', async () => {
    const prepCustom = { all: jest.fn().mockReturnValue([
      { result: 'success', count: 2, sync_date: '2025-11-02' }
    ]) };
    mockDb.prepare.mockReturnValueOnce(prepCustom);

    const res = await syncService.getSyncStats({ device_id: 'dev-1' });
    expect(res.stats[0]).toMatchObject({ result: 'success', count: 2 });
    expect(prepCustom.all).toHaveBeenCalledWith('dev-1');
  });

  it('getSyncStats con solo from_date', async () => {
    const prepCustom = { all: jest.fn().mockReturnValue([]) };
    mockDb.prepare.mockReturnValueOnce(prepCustom);

    const res = await syncService.getSyncStats({ device_id: 'dev-1', from_date: '2025-11-01' });
    expect(res.period.from).toBe('2025-11-01');
    expect(prepCustom.all).toHaveBeenCalledWith('dev-1', '2025-11-01');
  });

  it('getSyncStats con solo to_date', async () => {
    const prepCustom = { all: jest.fn().mockReturnValue([]) };
    mockDb.prepare.mockReturnValueOnce(prepCustom);

    const res = await syncService.getSyncStats({ device_id: 'dev-1', to_date: '2025-11-03' });
    expect(res.period.to).toBe('2025-11-03');
    expect(prepCustom.all).toHaveBeenCalledWith('dev-1', '2025-11-03');
  });
});
