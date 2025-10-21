import { dbService } from './db';
import { apiService } from './api';

class SyncService {
  constructor() {
    this.isSyncing = false;
    this.syncInterval = null;
    this.deviceId = this.getOrCreateDeviceId();
  }

  getOrCreateDeviceId() {
    let deviceId = localStorage.getItem('device_id');
    
    if (!deviceId) {
      deviceId = `pwa-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('device_id', deviceId);
    }
    
    return deviceId;
  }

  // ============================================
  // SYNC AUTOMÁTICO
  // ============================================

  startAutoSync(intervalMinutes = 5) {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Sync inmediato
    this.syncPendingRedemptions();

    // Sync periódico
    this.syncInterval = setInterval(() => {
      this.syncPendingRedemptions();
    }, intervalMinutes * 60 * 1000);

    console.log(`🔄 Auto-sync iniciado (cada ${intervalMinutes} minutos)`);
  }

  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('⏸️  Auto-sync detenido');
    }
  }

  // ============================================
  // SINCRONIZACIÓN DE CANJES
  // ============================================

  async syncPendingRedemptions() {
    if (this.isSyncing) {
      console.log('⏳ Sync ya en progreso, saltando...');
      return;
    }

    this.isSyncing = true;

    try {
      // Verificar conectividad
      const health = await apiService.checkHealth();
      if (!health.online) {
        console.log('📡 Sin conexión, sync pospuesto');
        return { success: false, reason: 'offline' };
      }

      // Obtener canjes pendientes
      const pending = await dbService.getPendingRedemptions();
      
      if (pending.length === 0) {
        console.log('✅ No hay canjes pendientes para sincronizar');
        return { success: true, synced: 0 };
      }

      console.log(`🔄 Sincronizando ${pending.length} canje(s) pendiente(s)...`);

      // Preparar batch para sync
      const redemptions = pending.map(p => ({
        local_id: p.local_id,
        voucher_code: p.voucher_code,
        cafeteria_id: p.cafeteria_id,
        local_timestamp: p.local_timestamp
      }));

      // Enviar al servidor
      const result = await apiService.syncRedemptions(this.deviceId, redemptions);

      // Procesar resultados
      let syncedCount = 0;
      let conflictCount = 0;
      let errorCount = 0;

      for (const syncResult of result.results) {
        if (syncResult.status === 'synced') {
          // Eliminar de pendientes
          await dbService.deletePendingRedemption(syncResult.local_id);
          syncedCount++;
          
        } else if (syncResult.status === 'conflict') {
          // Marcar como conflicto
          await dbService.updateRedemptionStatus(
            syncResult.local_id,
            'conflict',
            { conflict_reason: syncResult.reason }
          );
          
          // Agregar a tabla de conflictos
          await dbService.addConflict({
            local_id: syncResult.local_id,
            voucher_code: syncResult.voucher_code,
            reason: syncResult.reason,
            server_timestamp: syncResult.server_timestamp
          });
          
          conflictCount++;
          
        } else {
          // Error
          await dbService.incrementRedemptionAttempts(syncResult.local_id);
          errorCount++;
        }
      }

      console.log(`✅ Sync completado: ${syncedCount} exitosos, ${conflictCount} conflictos, ${errorCount} errores`);

      return {
        success: true,
        synced: syncedCount,
        conflicts: conflictCount,
        errors: errorCount
      };

    } catch (error) {
      console.error('❌ Error en sync:', error.message);
      return { success: false, error: error.message };
      
    } finally {
      this.isSyncing = false;
    }
  }

  // ============================================
  // MANEJO DE CONFLICTOS
  // ============================================

  async getConflicts() {
    return await dbService.getUnresolvedConflicts();
  }

  async resolveConflict(local_id, action) {
    // action: 'accept_server' | 'regenerate' | 'dismiss'
    
    if (action === 'accept_server') {
      // Eliminar canje local
      await dbService.deletePendingRedemption(local_id);
      await dbService.resolveConflict(local_id, 'accepted_server_version');
      
    } else if (action === 'regenerate') {
      // Marcar para regeneración manual
      await dbService.resolveConflict(local_id, 'marked_for_regeneration');
      
    } else if (action === 'dismiss') {
      // Solo marcar como resuelto
      await dbService.resolveConflict(local_id, 'dismissed');
    }
  }

  // ============================================
  // ESTADÍSTICAS
  // ============================================

  async getSyncStats() {
    const stats = await dbService.getStats();
    
    return {
      device_id: this.deviceId,
      pending_redemptions: stats.pending_redemptions,
      cached_vouchers: stats.cached_vouchers,
      unresolved_conflicts: stats.conflicts,
      auto_sync_active: !!this.syncInterval,
      last_sync: localStorage.getItem('last_sync_time')
    };
  }
}

export const syncService = new SyncService();