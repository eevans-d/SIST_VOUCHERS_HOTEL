# Servicios Experimentales

Este directorio contiene servicios experimentales que fueron desarrollados para funcionalidades avanzadas pero no están actualmente en uso en el core del sistema.

## ⚠️ Estado: EXPERIMENTAL
- **No utilizados** en producción actual
- **Código funcional** pero no integrado
- **Futuras extensiones** del sistema
- **Requiere integración** antes de usar

## 📁 Servicios Incluidos

### Analytics & BI
- `biDashboardService.js` - Dashboard de inteligencia de negocio
- `predictiveAnalyticsService.js` - Análisis predictivo  
- `dataWarehouseService.js` - Gestión de data warehouse
- `demandForecastingService.js` - Pronóstico de demanda

### Security & Monitoring  
- `anomalyDetectionService.js` - Detección de anomalías
- `ddosProtectionService.js` - Protección DDoS
- `complianceService.js` - Cumplimiento normativo
- `profilingService.js` - Profiling de performance

### API & Integration
- `apiGatewayService.js` - Gateway de APIs
- `apiVersioningService.js` - Versionado de APIs
- `graphqlService.js` - Servidor GraphQL
- `oauth2Service.js` - OAuth2 implementation
- `webhookService.js` - Sistema de webhooks

### Infrastructure
- `cdnService.js` - CDN management
- `loggingService.js` - Logging avanzado
- `tracingService.js` - Distributed tracing
- `prometheusService.js` - Métricas Prometheus
- `websocketService.js` - WebSocket real-time

### Business Intelligence
- `recommendationService.js` - Sistema de recomendaciones
- `priceOptimizationService.js` - Optimización de precios
- `eventSourcingService.js` - Event sourcing
- `reportBuilderService.js` - Constructor de reportes dinámicos
- `paginationService.js` - Paginación avanzada

## 🚀 Para Activar un Servicio

1. **Verificar dependencias** en package.json
2. **Mover al directorio principal** `/services/`
3. **Actualizar imports** en archivos que lo usen
4. **Agregar tests unitarios** correspondientes
5. **Documentar integración** en el README principal

## 📝 Notas de Desarrollo

- **Movidos en**: FASE 1.3 (Limpieza de código muerto)
- **Criterio**: No utilizados en rutas o casos de uso core
- **Total archivos**: 23 servicios (~15,000 líneas de código)
- **Potencial ahorro**: ~20,000 líneas incluyendo dependencias

---
**Última actualización**: Noviembre 2025 - FASE 1.3
