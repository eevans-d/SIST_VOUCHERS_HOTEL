import React, { useState, useEffect } from 'react';
import { syncService } from '../services/syncService';

export function SyncStatus() {
  const [stats, setStats] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadStats();
    
    const interval = setInterval(loadStats, 30000); // Actualizar cada 30s

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadStats = async () => {
    try {
      const data = await syncService.getSyncStats();
      setStats(data);
    } catch (error) {
      console.error('Error cargando stats:', error);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await syncService.syncPendingRedemptions();
      await loadStats();
    } finally {
      setSyncing(false);
    }
  };

  if (!stats) return null;

  return (
    <div className="sync-status">
      <div className="status-indicator">
        <span className={`status-dot ${isOnline ? 'online' : 'offline'}`}></span>
        <span className="status-text">
          {isOnline ? '🟢 En línea' : '🔴 Sin conexión'}
        </span>
      </div>

      {stats.pending_redemptions > 0 && (
        <div className="pending-badge">
          📤 {stats.pending_redemptions} pendiente(s)
        </div>
      )}

      {stats.unresolved_conflicts > 0 && (
        <div className="conflicts-badge">
          ⚠️ {stats.unresolved_conflicts} conflicto(s)
        </div>
      )}

      <button
        onClick={handleManualSync}
        disabled={syncing || !isOnline}
        className="btn-sync"
      >
        {syncing ? '⏳ Sincronizando...' : '🔄 Sincronizar ahora'}
      </button>
    </div>
  );
}