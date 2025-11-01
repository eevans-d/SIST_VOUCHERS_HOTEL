const fs = require('fs');
const path = require('path');

// Patrones a reemplazar
const patterns = [
  { search: /async syncRedemptions\(\{ device_id, redemptions, correlation_id, user_id \}\)/g, replace: 'async syncRedemptions({ device_id, redemptions, _correlation_id, user_id })' },
  { search: /async getOperationalMetrics\(\{ correlation_id \}\)/g, replace: 'async getOperationalMetrics({ _correlation_id })' },
  { search: /async generateRedemptionsCSV\(\{ filters, correlation_id \}\)/g, replace: 'async generateRedemptionsCSV({ filters, _correlation_id })' },
  { search: /async emitVouchers\(order_id, vouchers, correlation_id\)/g, replace: 'async emitVouchers(order_id, vouchers, _correlation_id)' },
  { search: /async validateVoucher\(\{ code, receptionista, correlation_id \}\)/g, replace: 'async validateVoucher({ code, receptionista, _correlation_id })' }
];

// Archivos a procesar
const files = [
  'src/services/syncService.js',
  'src/services/reportService.js',
  'src/services/voucherService.js'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  patterns.forEach(({ search, replace }) => {
    content = content.replace(search, replace);
  });
  fs.writeFileSync(file, content);
  console.log(`✅ ${file} actualizado`);
});
