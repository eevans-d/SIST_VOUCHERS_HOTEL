const { CryptoService } = require('../../src/services/cryptoService');

describe('CryptoService', () => {
  describe('generateVoucherHMAC', () => {
    it('debe generar HMAC de 64 caracteres hex', () => {
      const hmac = CryptoService.generateVoucherHMAC(
        'HPN-2025-0001',
        '2025-01-01',
        '2025-01-05',
        1
      );
      
      expect(hmac).toMatch(/^[a-f0-9]{64}$/);
    });

    it('debe generar HMAC consistente para mismos datos', () => {
      const hmac1 = CryptoService.generateVoucherHMAC(
        'HPN-2025-0001',
        '2025-01-01',
        '2025-01-05',
        1
      );
      
      const hmac2 = CryptoService.generateVoucherHMAC(
        'HPN-2025-0001',
        '2025-01-01',
        '2025-01-05',
        1
      );
      
      expect(hmac1).toBe(hmac2);
    });

    it('debe generar HMAC diferente para datos diferentes', () => {
      const hmac1 = CryptoService.generateVoucherHMAC(
        'HPN-2025-0001',
        '2025-01-01',
        '2025-01-05',
        1
      );
      
      const hmac2 = CryptoService.generateVoucherHMAC(
        'HPN-2025-0002',
        '2025-01-01',
        '2025-01-05',
        1
      );
      
      expect(hmac1).not.toBe(hmac2);
    });
  });

  describe('verifyVoucherHMAC', () => {
    it('debe verificar HMAC válido correctamente', () => {
      const hmac = CryptoService.generateVoucherHMAC(
        'HPN-2025-0001',
        '2025-01-01',
        '2025-01-05',
        1
      );
      
      const isValid = CryptoService.verifyVoucherHMAC(
        'HPN-2025-0001',
        '2025-01-01',
        '2025-01-05',
        1,
        hmac
      );
      
      expect(isValid).toBe(true);
    });

    it('debe rechazar HMAC inválido', () => {
      const isValid = CryptoService.verifyVoucherHMAC(
        'HPN-2025-0001',
        '2025-01-01',
        '2025-01-05',
        1,
        'invalid-hmac-signature-here'
      );
      
      expect(isValid).toBe(false);
    });

    it('debe rechazar HMAC con datos modificados', () => {
      const hmac = CryptoService.generateVoucherHMAC(
        'HPN-2025-0001',
        '2025-01-01',
        '2025-01-05',
        1
      );
      
      const isValid = CryptoService.verifyVoucherHMAC(
        'HPN-2025-0002', // Código modificado
        '2025-01-01',
        '2025-01-05',
        1,
        hmac
      );
      
      expect(isValid).toBe(false);
    });
  });

  describe('generateVoucherCode', () => {
    it('debe generar código con formato correcto', () => {
      const code = CryptoService.generateVoucherCode(1);
      expect(code).toMatch(/^HPN-\d{4}-\d{4}$/);
    });

    it('debe incluir el año actual', () => {
      const code = CryptoService.generateVoucherCode(1);
      const year = new Date().getFullYear();
      expect(code).toContain(`-${year}-`);
    });

    it('debe padear números con ceros', () => {
      const code1 = CryptoService.generateVoucherCode(1);
      const code99 = CryptoService.generateVoucherCode(99);
      const code1000 = CryptoService.generateVoucherCode(1000);
      
      expect(code1).toMatch(/-0001$/);
      expect(code99).toMatch(/-0099$/);
      expect(code1000).toMatch(/-1000$/);
    });
  });

  describe('parseQRData', () => {
    it('debe parsear QR válido correctamente', () => {
      const qrData = 'HPN-2025-0001|abcd1234|2025-01-05';
      const parsed = CryptoService.parseQRData(qrData);
      
      expect(parsed).toEqual({
        code: 'HPN-2025-0001',
        hmac: 'abcd1234',
        validUntil: '2025-01-05'
      });
    });

    it('debe lanzar error con formato inválido', () => {
      expect(() => {
        CryptoService.parseQRData('invalid-format');
      }).toThrow('INVALID_QR_DATA');
    });

    it('debe lanzar error con número incorrecto de campos', () => {
      expect(() => {
        CryptoService.parseQRData('HPN-2025-0001|abcd1234');
      }).toThrow('INVALID_QR_DATA');
    });
  });
});