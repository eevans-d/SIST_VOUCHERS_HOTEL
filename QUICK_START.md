# ⚡ Quick Start - 5 Minutos

## 1️⃣ Instalar Dependencias (1 min)
```bash
cd vouchers-hostal-playa-norte/backend
npm install
```

## 2️⃣ Configurar Entorno (1 min)
```bash
# Crear .env desde template
cp .env.example .env

# Valores por defecto ya están configurados
# Solo editar si necesitas cambiar puerto o DB path
```

## 3️⃣ Inicializar BD (1 min)
```bash
bash scripts/init-database.sh
```

**Si no existe script, ejecutar:**
```bash
sqlite3 db/vouchers.db < schema.sql
```

## 4️⃣ Ejecutar Server (1 min)
```bash
npm start
```

**Debe mostrar:**
```
✅ Server listening on port 3005
✅ Database connected
✅ All services initialized
```

## 5️⃣ Probar API (1 min)
```bash
# Test rápido
curl http://localhost:3005/health

# Debe responder: {"status":"ok"}
```

---

## 🧪 Validar Instalación

```bash
# Test unitarios
npm test

# Debe mostrar: ✓ All tests passed (85%+ coverage)
```

---

## 📚 Próximos Pasos

| Tarea | Documento |
|-------|-----------|
| Entender arquitectura | BLUEPRINT_ARQUITECTURA.md |
| Ver todos los endpoints | RESUMEN_EJECUTIVO_FINAL.md |
| Probar con Postman | MODULO_*_README.md |
| Deployar | GUIA_EJECUCION.md |

---

## 🆘 Problemas?

| Error | Solución |
|-------|----------|
| Puerto en uso | Cambiar PORT en .env |
| BD bloqueada | `rm db/vouchers.db-wal*` |
| Módulos no encontrados | `rm -rf node_modules && npm install` |

---

## ✅ Checklist de Funcionalidad

- [ ] Server inicia sin errores
- [ ] Health check responde
- [ ] Tests pasan
- [ ] BD tiene 9 tablas
- [ ] Puedo registrar usuario
- [ ] Puedo hacer login
- [ ] Puedo crear estadía
- [ ] Puedo generar voucher
- [ ] Puedo crear orden

**¡Si todo funciona = LISTO para desarrollo!** 🎉
