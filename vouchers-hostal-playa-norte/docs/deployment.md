# 🚀 Guía de Deployment

## Índice

1. [Prerequisitos](#prerequisitos)
2. [Fly.io (Recomendado)](#flyio)
3. [VPS/Cloud](#vpscloud)
4. [Docker](#docker)
5. [Configuración SSL](#ssl)
6. [Monitoreo](#monitoreo)
7. [Backup](#backup)
8. [Rollback](#rollback)

---

## Prerequisitos

### Requisitos Mínimos

- **CPU**: 1 vCPU
- **RAM**: 512 MB
- **Storage**: 1 GB (SSD)
- **Bandwidth**: 1 TB/mes
- **Node.js**: 18+
- **Sistema**: Linux (Ubuntu 22.04 LTS recomendado)

### Requisitos Recomendados

- **CPU**: 2 vCPU
- **RAM**: 1 GB
- **Storage**: 5 GB (SSD)
- **Backup**: Automático diario
- **CDN**: Cloudflare (opcional)

---

## Fly.io

### 1. Instalación Fly CLI

```bash
curl -L https://fly.io/install.sh | sh
```
2. Login
```bash
fly auth login
```
3. Crear App
```bash
cd backend
fly launch --name hostal-vouchers --region gru
```
4. Configurar Secretos
```bash
# Generar secretos
./scripts/generate-secrets.sh

# Configurar en Fly.io
fly secrets set \
  VOUCHER_SECRET=\"...\" \
  JWT_SECRET=\"...\" \
  ALLOWED_ORIGINS=\"https://pwa.hostalplayanorte.com\" \
  --app hostal-vouchers
```
5. Crear Volumen
```bash
fly volumes create vouchers_data \
  --size 1 \
  --region gru \
  --app hostal-vouchers
```
6. Deploy
```bash
fly deploy --app hostal-vouchers
```
7. Verificar
```bash
# Status
fly status --app hostal-vouchers

# Logs
fly logs --app hostal-vouchers

# SSH
fly ssh console --app hostal-vouchers
```
8. Configurar Dominio
```bash
# Agregar dominio
fly certs add api.hostalplayanorte.com --app hostal-vouchers

# Verificar DNS
fly certs show api.hostalplayanorte.com --app hostal-vouchers
```
## VPS/Cloud

1. Setup Inicial
```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar PM2
sudo npm install -g pm2

# Instalar nginx
sudo apt install -y nginx

# Instalar certbot (SSL)
sudo apt install -y certbot python3-certbot-nginx
```
2. Clonar Proyecto
```bash
cd /var/www
sudo git clone https://github.com/hostal/vouchers.git
sudo chown -R $USER:$USER vouchers
cd vouchers
```
3. Configurar Backend
```bash
cd backend
npm ci --only=production
cp .env.example .env
nano .env  # Editar configuración
```
4. Setup Base de Datos
```bash
npm run db:setup
```
5. Configurar PM2
```javascript
ecosystem.config.js

module.exports = {
  apps: [{
    name: 'vouchers-backend',
    script: './src/server.js',
    cwd: '/var/www/vouchers/backend',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/pm2/vouchers-error.log',
    out_file: '/var/log/pm2/vouchers-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '500M'
  }]
};
```
```bash
# Iniciar
pm2 start ecosystem.config.js

# Auto-start al reiniciar
pm2 startup
pm2 save

# Monitoreo
pm2 monit
```
6. Configurar Nginx
```nginx
/etc/nginx/sites-available/vouchers

# Backend API
server {
    listen 80;
    server_name api.hostalplayanorte.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}

# PWA Cafetería
server {
    listen 80;
    server_name pwa.hostalplayanorte.com;
    root /var/www/vouchers/pwa-cafeteria/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3000;
    }
}
```
```bash
# Activar sitio
sudo ln -s /etc/nginx/sites-available/vouchers /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```
7. Configurar SSL
```bash
sudo certbot --nginx -d api.hostalplayanorte.com -d pwa.hostalplayanorte.com
```
## Docker

1. Build
```bash
# Backend
docker build -t vouchers-backend:latest ./backend

# PWA
docker build -t vouchers-pwa:latest ./pwa-cafeteria
```
2. Run
```bash
docker-compose up -d
```
3. Logs
```bash
docker-compose logs -f
```
4. Backup
```bash
docker exec vouchers-backend node scripts/backup-db.sh
```
## Configuración SSL

Let\'s Encrypt (Automático)
```bash
sudo certbot --nginx -d api.hostalplayanorte.com
```
Renovación Automática
```bash
# Test
sudo certbot renew --dry-run

# Cron job (ya configurado por certbot)
sudo crontab -l | grep certbot
```
## Monitoreo

Health Checks
```bash
# Endpoint
curl https://api.hostalplayanorte.com/health

# Uptime monitoring (UptimeRobot, Pingdom, etc.)
# Configurar alertas a: ops@hostalplayanorte.com
```
Logs
```bash
# PM2
pm2 logs vouchers-backend

# Fly.io
fly logs --app hostal-vouchers

# Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```
Métricas
```bash
# PM2
pm2 monit

# Fly.io
fly dashboard --app hostal-vouchers
```
## Backup

Automático (Cron)
```bash
# Editar crontab
crontab -e

# Agregar backup diario a las 3 AM
0 3 * * * /var/www/vouchers/backend/scripts/backup-db.sh /backups
```
Manual
```bash
cd /var/www/vouchers/backend
./scripts/backup-db.sh
```
Restauración
```bash
# Detener servicio
pm2 stop vouchers-backend

# Restaurar
cp /backups/vouchers_backup_YYYYMMDD_HHMMSS.db.gz /data/
gunzip /data/vouchers_backup_YYYYMMDD_HHMMSS.db.gz
mv /data/vouchers_backup_YYYYMMDD_HHMMSS.db /data/vouchers.db

# Reiniciar
pm2 start vouchers-backend
```
## Rollback

Fly.io
```bash
# Ver releases
fly releases --app hostal-vouchers

# Rollback a versión anterior
fly releases rollback <VERSION> --app hostal-vouchers
```
PM2
```bash
# Detener
pm2 stop vouchers-backend

# Checkout versión anterior
cd /var/www/vouchers
git checkout <COMMIT_HASH>
cd backend
npm ci --only=production

# Reiniciar
pm2 restart vouchers-backend
```
Checklist Pre-Producción
* Tests pasando (npm test)
* Variables de entorno configuradas
* Secretos rotados
* SSL configurado
* Health checks funcionando
* Backups automáticos configurados
* Monitoreo activo
* Logs estructurados
* Rate limiting configurado
* Documentación actualizada
* Plan de rollback probado

Soporte
Emergencias: +54 9 11 XXXX-XXXX
Email: ops@hostalplayanorte.com
Documentación: https://docs.hostalplayanorte.com
