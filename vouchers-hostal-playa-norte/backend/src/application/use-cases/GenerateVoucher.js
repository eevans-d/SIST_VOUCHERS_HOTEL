import { z } from 'zod';
import { Voucher } from '../../domain/entities/Voucher.js';

const GenerateVoucherDTO = z.object({
  stayId: z.string().uuid(),
  numberOfVouchers: z.number().int().positive(),
});

export class GenerateVoucher {
  constructor(voucherRepository, stayRepository, cryptoService, logger) {
    this.voucherRepository = voucherRepository;
    this.stayRepository = stayRepository;
    this.cryptoService = cryptoService;
    this.logger = logger;
  }

  async execute(input) {
    const validated = GenerateVoucherDTO.parse(input);
    const { stayId, numberOfVouchers } = validated;

    const stay = await this.stayRepository.findById(stayId);
    if (!stay) {
      throw new Error('Stay not found');
    }

    const vouchers = [];
    for (let i = 0; i < numberOfVouchers; i++) {
      const code = `HPN-${new Date().getFullYear()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const dataToSign = `${code}|${stay.checkInDate.toISOString()}|${stay.checkOutDate.toISOString()}|${stay.id}`;
      const hmacSignature = this.cryptoService.generateHmac(dataToSign);

      const voucher = Voucher.create({
        code,
        stayId: stay.id,
        validFrom: stay.checkInDate,
        validUntil: stay.checkOutDate,
        hmacSignature,
      });

      await this.voucherRepository.save(voucher);
      vouchers.push(voucher);
    }

    this.logger.info(`${numberOfVouchers} vouchers generated for stay ${stayId}`);
    return vouchers.map(v => v.toJSON());
  }
}

const ValidateVoucherDTO = z.object({
  code: z.string(),
  hmac: z.string(),
});

export class ValidateVoucher {
  constructor(voucherRepository, cryptoService, logger) {
    this.voucherRepository = voucherRepository;
    this.cryptoService = cryptoService;
    this.logger = logger;
  }

  async execute(input) {
    const validated = ValidateVoucherDTO.parse(input);
    const { code, hmac } = validated;

    const voucher = await this.voucherRepository.findByCode(code);
    if (!voucher) {
      throw new Error('Voucher not found');
    }

    const stay = await this.stayRepository.findById(voucher.stayId);
    if (!stay) {
      throw new Error('Stay not found');
    }

    const dataToSign = `${voucher.code}|${stay.checkInDate.toISOString()}|${stay.checkOutDate.toISOString()}|${stay.id}`;
    const isValid = this.cryptoService.verifyHmac(dataToSign, hmac);

    if (!isValid) {
      throw new Error('Invalid HMAC signature');
    }

    return { ...voucher.toJSON(), isValid };
  }
}

const RedeemVoucherDTO = z.object({
  code: z.string(),
});

export class RedeemVoucher {
  constructor(voucherRepository, logger) {
    this.voucherRepository = voucherRepository;
    this.logger = logger;
  }

  async execute(input) {
    const validated = RedeemVoucherDTO.parse(input);
    const { code } = validated;

    const voucher = await this.voucherRepository.findByCode(code);
    if (!voucher) {
      throw new Error('Voucher not found');
    }

    voucher.redeem();

    await this.voucherRepository.update(voucher);

    this.logger.info(`Voucher ${code} redeemed successfully`);
    return voucher.toJSON();
  }
}