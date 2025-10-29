import crypto from 'crypto';

export class CryptoService {
  constructor(secret) {
    if (!secret || secret.length < 32) {
      throw new Error('HMAC secret must be at least 32 characters long');
    }
    this.secret = secret;
  }

  generateHmac(data) {
    return crypto.createHmac('sha256', this.secret).update(data).digest('hex');
  }

  verifyHmac(data, hmac) {
    const expectedHmac = this.generateHmac(data);
    return crypto.timingSafeEqual(Buffer.from(expectedHmac), Buffer.from(hmac));
  }
}

export default CryptoService;
