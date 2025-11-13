/**
 * @file services.setup.js
 * @description Inicialización de servicios, repositorios y use-cases
 */

import { UserRepository } from '../domain/repositories/UserRepository.js';
import { StayRepository } from '../domain/repositories/StayRepository.js';
import { VoucherRepository } from '../domain/repositories/VoucherRepository.js';
import { OrderRepository } from '../domain/repositories/OrderRepository.js';
import { JWTService } from '../infrastructure/security/JWTService.js';
import { PasswordService } from '../infrastructure/security/PasswordService.js';
import { CryptoService } from '../infrastructure/security/CryptoService.js';
import { LoginUser } from '../application/use-cases/LoginUser.js';
import { RegisterUser } from '../application/use-cases/RegisterUser.js';
import { CreateStay } from '../application/use-cases/CreateStay.js';
import { GenerateVoucher } from '../application/use-cases/GenerateVoucher.js';
import { ValidateVoucher } from '../application/use-cases/ValidateVoucher.js';
import { RedeemVoucher } from '../application/use-cases/RedeemVoucher.js';
import { CreateOrder } from '../application/use-cases/CreateOrder.js';
import { CompleteOrder } from '../application/use-cases/CompleteOrder.js';
import { ReportService } from '../application/services/ReportService.js';
import { config } from './app.config.js';
import { logger } from './logger.setup.js';

function initializeSecurityServices() {
  return {
    jwtService: new JWTService(config.jwt.secret, config.jwt.refreshSecret),
    passwordService: new PasswordService(config.bcryptRounds),
    cryptoService: new CryptoService(config.voucherSecret)
  };
}

function initializeRepositories(db) {
  return {
    userRepository: new UserRepository(db),
    stayRepository: new StayRepository(db),
    voucherRepository: new VoucherRepository(db),
    orderRepository: new OrderRepository(db)
  };
}

function initializeUseCases(repos, security) {
  const { userRepository, stayRepository, voucherRepository, orderRepository } =
    repos;
  const { jwtService, passwordService, cryptoService } = security;

  return {
    loginUser: new LoginUser(userRepository, passwordService, jwtService, logger),
    registerUser: new RegisterUser(userRepository, passwordService, logger),
    createStay: new CreateStay(stayRepository, userRepository, logger),
    generateVoucher: new GenerateVoucher(
      stayRepository,
      voucherRepository,
      cryptoService,
      logger
    ),
    validateVoucher: new ValidateVoucher(
      voucherRepository,
      stayRepository,
      cryptoService,
      logger
    ),
    redeemVoucher: new RedeemVoucher(voucherRepository, logger),
    createOrder: new CreateOrder(stayRepository, orderRepository, logger),
    completeOrder: new CompleteOrder(orderRepository, voucherRepository, logger)
  };
}

export function initializeServices(db) {
  const security = initializeSecurityServices();
  const repositories = initializeRepositories(db);
  const useCases = initializeUseCases(repositories, security);

  const reportService = new ReportService({
    stayRepository: repositories.stayRepository,
    orderRepository: repositories.orderRepository,
    voucherRepository: repositories.voucherRepository,
    logger
  });

  logger.info('✅ Servicios inicializados correctamente');

  return {
    jwtService: security.jwtService,
    ...repositories,
    ...useCases,
    reportService
  };
}
