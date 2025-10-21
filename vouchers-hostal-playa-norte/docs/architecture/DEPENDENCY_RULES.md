# Dependency Rules - Arquitectura Hexagonal

## Reglas Obligatorias

1. **Domain NO depende de nadie**
   - ✅ Puede importar otros módulos de domain/
   - ❌ NO puede importar application/
   - ❌ NO puede importar infrastructure/
   - ❌ NO puede importar presentation/

2. **Application solo depende de Domain**
   - ✅ Puede importar domain/
   - ✅ Puede importar otros módulos de application/
   - ❌ NO puede importar infrastructure/
   - ❌ NO puede importar presentation/

3. **Infrastructure depende de Application y Domain**
   - ✅ Puede importar domain/
   - ✅ Puede importar application/ (interfaces)
   - ✅ Puede importar otros módulos de infrastructure/
   - ❌ NO puede importar presentation/

4. **Presentation depende de Application**
   - ✅ Puede importar application/
   - ✅ Puede importar domain/
   - ✅ Puede importar otros módulos de presentation/
   - ⚠️ Puede importar infrastructure/ SOLO para configuración

## Violaciones Comunes

❌ PROHIBIDO: `domain/entities/Voucher.js` importa `infrastructure/persistence/VoucherRepository.js`
✅ CORRECTO: `infrastructure/persistence/VoucherRepository.js` implementa interfaz de `domain/repositories/VoucherRepository.js`

❌ PROHIBIDO: `application/handlers/EmitVoucherHandler.js` importa `presentation/http/controllers/VoucherController.js`
✅ CORRECTO: `presentation/http/controllers/VoucherController.js` inyecta `application/handlers/EmitVoucherHandler.js`

## Verificación

Ejecutar:
```bash
npm run lint:dependencies
```

Para automatizar verificación de reglas de dependencia.
