import React, { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export function Scanner({ onScan, onError }) {
  const [scanner, setScanner] = useState(null);
  const [manualInput, setManualInput] = useState('');
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    const html5QrcodeScanner = new Html5QrcodeScanner(
      'qr-reader',
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      },
      false
    );

    html5QrcodeScanner.render(
      (decodedText) => {
        onScan(decodedText);
        html5QrcodeScanner.clear();
      },
      (error) => {
        // Ignorar errores de escaneo continuo
        if (!error.includes('NotFoundException')) {
          console.warn('QR Scan error:', error);
        }
      }
    );

    setScanner(html5QrcodeScanner);

    return () => {
      html5QrcodeScanner.clear().catch(console.error);
    };
  }, [onScan]);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualInput.trim()) {
      onScan(manualInput.trim());
      setManualInput('');
      setShowManual(false);
    }
  };

  return (
    <div className="scanner-container">
      {!showManual ? (
        <>
          <div id="qr-reader" className="qr-reader"></div>
          <button
            onClick={() => setShowManual(true)}
            className="btn-secondary mt-4"
          >
            📝 Ingresar código manualmente
          </button>
        </>
      ) : (
        <form onSubmit={handleManualSubmit} className="manual-input-form">
          <h3>Ingreso Manual</h3>
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="HPN-2025-0001"
            className="input-voucher-code"
            autoFocus
          />
          <div className="button-group">
            <button type="submit" className="btn-primary">
              ✓ Validar
            </button>
            <button
              type="button"
              onClick={() => setShowManual(false)}
              className="btn-secondary"
            >
              📷 Volver a escanear
            </button>
          </div>
        </form>
      )}
    </div>
  );
}