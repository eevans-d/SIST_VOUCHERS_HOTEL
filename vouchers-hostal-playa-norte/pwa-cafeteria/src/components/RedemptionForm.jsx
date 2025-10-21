import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { dbService } from '../services/db';
import { syncService } from '../services/syncService';
import toast from 'react-hot-toast';

export function RedemptionForm({ voucher, onSuccess, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRedeem = async () => {
    setLoading(true);

    try {
      const user = apiService.getCurrentUser();
      const cafeteriaId = user?.cafeteria_id || 1;

      // Intentar canje online
      if (!isOffline) {
        try {
          const result = await apiService.redeemVoucher(
            voucher.code,
            cafeteriaId,
            syncService.deviceId
          );

          toast.success('✅ Voucher canjeado exitosamente');
          onSuccess(result);
          return;

        } catch (error) {
          if (error.response?.status === 409) {
            // Conflicto: ya canjeado
            toast.error('⚠️ Este voucher ya fue canjeado');
            return;
          }
          
          // Si falla online, intentar offline
          console.warn('Canje online falló, guardando offline:', error.message);
        }
      }

      // Modo offline
      const localId = `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      await dbService.addPendingRedemption({
        local_id: localId,
        voucher_code: voucher.code,
        cafeteria_id: cafeteriaId,
        local_timestamp: new Date().toISOString(),
        voucher_data: voucher
      });

      toast.success('📴 Canje guardado offline\n(Se sincronizará automáticamente)', {
        duration: 4000
      });

      onSuccess({ offline: true, local_id: localId });

    } catch (error) {
      console.error('Error en canje:', error);
      toast.error('❌ Error al procesar canje');
      
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="redemption-form">
      <div className="voucher-details">
        <h2>Confirmar Canje</h2>
        
        <div className="detail-row">
          <span className="label">Código:</span>
          <span className="value">{voucher.code}</span>
        </div>
        
        <div className="detail-row">
          <span className="label">Huésped:</span>
          <span className="value">{voucher.guest_name}</span>
        </div>
        
        <div className="detail-row">
          <span className="label">Habitación:</span>
          <span className="value">{voucher.room}</span>
        </div>
        
        <div className="detail-row">
          <span className="label">Válido hasta:</span>
          <span className="value">{voucher.valid_until}</span>
        </div>

        {isOffline && (
          <div className="offline-warning">
            📴 Modo offline - El canje se sincronizará automáticamente
          </div>
        )}
      </div>

      <div className="button-group">
        <button
          onClick={handleRedeem}
          disabled={loading}
          className="btn-primary btn-lg"
        >
          {loading ? '⏳ Procesando...' : '✓ Confirmar Canje'}
        </button>
        
        <button
          onClick={onCancel}
          disabled={loading}
          className="btn-secondary"
        >
          ✕ Cancelar
        </button>
      </div>
    </div>
  );
}
