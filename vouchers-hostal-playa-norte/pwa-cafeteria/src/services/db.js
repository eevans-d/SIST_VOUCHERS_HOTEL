import { openDB } from 'idb';

const DB_NAME = 'vouchers-cafeteria';
const DB_VERSION = 3;

class IndexedDBService {
  constructor() {
    this.db = null;
  }

  async init() {
    if (this.db) return this.db;

    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        // Store: pending_redemptions
        if (!db.objectStoreNames.contains('pending_redemptions')) {
          const redemptionsStore = db.createObjectStore('pending_redemptions', {
            keyPath: 'local_id'
          });
          redemptionsStore.createIndex('status', 'status');
          redemptionsStore.createIndex('timestamp', 'local_timestamp');
          redemptionsStore.createIndex('voucher_code', 'voucher_code');
        }

        // Store: cached_vouchers
        if (!db.objectStoreNames.contains('cached_vouchers')) {
          const vouchersStore = db.createObjectStore('cached_vouchers', {
            keyPath: 'code'
          });
          vouchersStore.createIndex('status', 'status');
          vouchersStore.createIndex('cached_at', 'cached_at');
        }

        // Store: sync_queue
        if (!db.objectStoreNames.contains('sync_queue')) {
          const syncStore = db.createObjectStore('sync_queue', {
            keyPath: 'id',
            autoIncrement: true
          });
          syncStore.createIndex('status', 'status');
          syncStore.createIndex('created_at', 'created_at');
        }

        // Store: conflicts
        if (!db.objectStoreNames.contains('conflicts')) {
          const conflictsStore = db.createObjectStore('conflicts', {
            keyPath: 'local_id'
          });
          conflictsStore.createIndex('detected_at', 'detected_at');
          conflictsStore.createIndex('resolved', 'resolved');
        }
      }
    });

    return this.db;
  }

  // ============================================
  // PENDING REDEMPTIONS
  // ============================================

  async addPendingRedemption(redemption) {
    const db = await this.init();
    const tx = db.transaction('pending_redemptions', 'readwrite');
    await tx.store.add({
      ...redemption,
      status: 'pending',
      attempts: 0,
      created_at: new Date().toISOString()
    });
    await tx.done;
  }

  async getPendingRedemptions() {
    const db = await this.init();
    const tx = db.transaction('pending_redemptions', 'readonly');
    const redemptions = await tx.store.index('status').getAll('pending');
    return redemptions;
  }

  async updateRedemptionStatus(local_id, status, details = {}) {
    const db = await this.init();
    const tx = db.transaction('pending_redemptions', 'readwrite');
    const redemption = await tx.store.get(local_id);
    
    if (redemption) {
      await tx.store.put({
        ...redemption,
        status,
        ...details,
        updated_at: new Date().toISOString()
      });
    }
    
    await tx.done;
  }

  async deletePendingRedemption(local_id) {
    const db = await this.init();
    await db.delete('pending_redemptions', local_id);
  }

  async incrementRedemptionAttempts(local_id) {
    const db = await this.init();
    const tx = db.transaction('pending_redemptions', 'readwrite');
    const redemption = await tx.store.get(local_id);
    
    if (redemption) {
      redemption.attempts = (redemption.attempts || 0) + 1;
      redemption.last_attempt = new Date().toISOString();
      await tx.store.put(redemption);
    }
    
    await tx.done;
  }

  // ============================================
  // CACHED VOUCHERS
  // ============================================

  async cacheVoucher(voucher) {
    const db = await this.init();
    await db.put('cached_vouchers', {
      ...voucher,
      cached_at: new Date().toISOString()
    });
  }

  async getCachedVoucher(code) {
    const db = await this.init();
    return await db.get('cached_vouchers', code);
  }

  async getCachedVouchers() {
    const db = await this.init();
    return await db.getAll('cached_vouchers');
  }

  async clearExpiredCache() {
    const db = await this.init();
    const tx = db.transaction('cached_vouchers', 'readwrite');
    const vouchers = await tx.store.getAll();
    const now = new Date();
    
    for (const voucher of vouchers) {
      const cachedAt = new Date(voucher.cached_at);
      const hoursSinceCached = (now - cachedAt) / (1000 * 60 * 60);
      
      // Eliminar cache mayor a 24 horas
      if (hoursSinceCached > 24) {
        await tx.store.delete(voucher.code);
      }
    }
    
    await tx.done;
  }

  // ============================================
  // CONFLICTS
  // ============================================

  async addConflict(conflict) {
    const db = await this.init();
    await db.put('conflicts', {
      ...conflict,
      detected_at: new Date().toISOString(),
      resolved: false
    });
  }

  async getUnresolvedConflicts() {
    const db = await this.init();
    const tx = db.transaction('conflicts', 'readonly');
    const conflicts = await tx.store.index('resolved').getAll(false);
    return conflicts;
  }

  async resolveConflict(local_id, resolution) {
    const db = await this.init();
    const tx = db.transaction('conflicts', 'readwrite');
    const conflict = await tx.store.get(local_id);
    
    if (conflict) {
      await tx.store.put({
        ...conflict,
        resolved: true,
        resolution,
        resolved_at: new Date().toISOString()
      });
    }
    
    await tx.done;
  }

  // ============================================
  // UTILITIES
  // ============================================

  async clearAll() {
    const db = await this.init();
    const tx = db.transaction(
      ['pending_redemptions', 'cached_vouchers', 'sync_queue', 'conflicts'],
      'readwrite'
    );
    
    await Promise.all([
      tx.objectStore('pending_redemptions').clear(),
      tx.objectStore('cached_vouchers').clear(),
      tx.objectStore('sync_queue').clear(),
      tx.objectStore('conflicts').clear()
    ]);
    
    await tx.done;
  }

  async getStats() {
    const db = await this.init();
    
    return {
      pending_redemptions: await db.count('pending_redemptions'),
      cached_vouchers: await db.count('cached_vouchers'),
      conflicts: await db.count('conflicts')
    };
  }
}

export const dbService = new IndexedDBService();