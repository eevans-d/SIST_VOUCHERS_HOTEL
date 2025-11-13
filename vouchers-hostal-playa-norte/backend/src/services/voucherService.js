// Fachada de VoucherService: el cuerpo legado se ha movido a módulos especializados.

// Nueva fachada: delega en módulos especializados.
import { emitVouchersLogic } from './voucher/emit.js';
import { validateVoucherLogic } from './voucher/validate.js';
import { redeemVoucherLogic } from './voucher/redeem.js';
import { cancelVoucherLogic } from './voucher/cancel.js';
import { getVoucherLogic } from './voucher/get.js';

class VoucherService {
  async emitVouchers(params) { return emitVouchersLogic(params); }
  async getVoucher(code, correlation_id) { return getVoucherLogic({ code, correlation_id }); }
  async validateVoucher(params) { return validateVoucherLogic(params); }
  async redeemVoucher(params) { return redeemVoucherLogic(params); }
  async cancelVoucher(params) { return cancelVoucherLogic(params); }
}

export { VoucherService };
export const voucherService = new VoucherService();
