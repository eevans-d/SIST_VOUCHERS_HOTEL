import React, { useState, useEffect } from 'react';
import { syncService } from '../services/syncService';
import toast from 'react-hot-toast';

export function ConflictsList() {
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConflicts();
  }, []);

  const loadConflicts = async () => {
    setLoading(true);
    try {
      const data = await syncService.getConflicts();
      setConflicts(data);
    } catch (error) {
      console.error('Error cargando conflictos:', error);
      toast.error('Error al cargar conflictos');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (conflict, action) => {
    try {
      await syncService.resolveConflict(conflict.local_id, action);
      toast.success('Conflicto resuelto');
      loadConflicts();
    } catch (error) {
      console.error('Error resolviendo conflicto:', error);
      toast.error('Error al resolver conflicto');
    }
  };

  if (loading) {
    return <div className="loading">Cargando conflictos...</div>;
  }

  if (conflicts.length === 0) {
    return (
      <div className="no-conflicts">
        <p>✅ No hay conflictos pendientes</p>
      </div>
    );
  }

  return (
    <div className="conflicts-list">
      <h2>⚠️ Conflictos de Sincronización ({conflicts.length})</h2>
      
      {conflicts.map((conflict) => (
        <div key={conflict.local_id} className="conflict-card">
          <div className="conflict-header">
            <span className="voucher-code">{conflict.voucher_code}</span>
            <span className="conflict-reason">{conflict.reason}</span>
          </div>
          
          <div className="conflict-details">
            <p><strong>Detectado:</strong> {new Date(conflict.detected_at).toLocaleString()}</p>
            <p><strong>Servidor:</strong> {conflict.server_timestamp}</p>
          </div>
          
          <div className="conflict-actions">
            <button
              onClick={() => handleResolve(conflict, 'accept_server')}
              className="btn-primary btn-sm"
            >
              ✓ Aceptar versión del servidor
            </button>
            
            <button
              onClick={() => handleResolve(conflict, 'regenerate')}
              className="btn-warning btn-sm"
            >
              🔄 Marcar para regenerar
            </button>
            
            <button
              onClick={() => handleResolve(conflict, 'dismiss')}
              className="btn-secondary btn-sm"
            >
              ✕ Descartar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}