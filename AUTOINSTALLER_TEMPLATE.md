# Plantilla para Crear Autoinstaladores de Aplicaciones Node.js

## Prompt para usar con el Agente de Replit

Copia y adapta este prompt cuando necesites crear un autoinstalador para una nueva aplicación:

---

### PROMPT TEMPLATE

```
Necesito crear un script autoinstalador (install.sh) para mi aplicación [NOMBRE_APP] que se desplegará en un servidor Ubuntu 22.04/24.04 con las siguientes características:

## Información del Servidor
- IP del servidor: [IP_SERVIDOR]
- Puerto de la aplicación: [PUERTO] (ejemplo: 5000)
- Dominio (opcional): [DOMINIO]
- Usuario del sistema para la app: [USUARIO_SISTEMA] (ejemplo: miapp)

## Stack Tecnológico
- Runtime: Node.js [VERSION] (ejemplo: 20.x)
- Base de datos: [PostgreSQL/MySQL/MongoDB/SQLite/Ninguna]
- Gestor de procesos: PM2
- Servidor web/proxy: Nginx

## Repositorio
- URL del repositorio: [URL_REPO_GITHUB]
- Rama principal: [main/master]
- ¿Requiere token de acceso privado?: [Sí/No]

## Variables de Entorno Requeridas
Lista las variables que necesita tu aplicación:
- DATABASE_URL: Conexión a base de datos
- SESSION_SECRET: Secreto para sesiones (generar automáticamente)
- [OTRAS_VARIABLES]: [DESCRIPCIÓN]

## Configuración de Base de Datos (si aplica)
- Nombre de la base de datos: [NOMBRE_BD]
- Usuario de la BD: [USUARIO_BD]
- ¿Contraseña predefinida o generada?: [predefinida: XXXX / generar]

## Requisitos Especiales
- ¿Necesita SSL/HTTPS?: [Sí con Let's Encrypt / Sí con Cloudflare / No]
- ¿Necesita cron jobs?: [Sí/No] - Describir
- ¿Necesita almacenamiento de archivos?: [Sí/No] - Ruta
- ¿Tiene proceso de build?: [npm run build / otro]
- ¿Comando para iniciar?: [npm start / npm run dev / otro]

## Estructura del Instalador Deseada
El script debe:
1. Verificar que se ejecuta como root
2. Instalar dependencias del sistema (Node.js, [BD], Nginx, PM2)
3. Crear usuario del sistema para la aplicación
4. Configurar la base de datos (crear BD, usuario, permisos)
5. Clonar el repositorio
6. Instalar dependencias de Node.js
7. Configurar variables de entorno (.env)
8. Ejecutar migraciones de base de datos (si aplica)
9. Configurar PM2 para gestionar la aplicación
10. Configurar Nginx como proxy reverso
11. (Opcional) Configurar SSL con Certbot
12. Configurar firewall (UFW)
13. Mostrar resumen de la instalación

## Manejo de Errores
- El script debe detenerse ante cualquier error crítico
- Debe mostrar mensajes claros de progreso
- Debe validar que los servicios están funcionando

## Post-instalación
Instrucciones adicionales que deben mostrarse al usuario:
- [INSTRUCCIONES_ESPECIALES]
```

---

## Ejemplo Completo Basado en Audivia

Este es un ejemplo real del autoinstalador creado para Audivia:

### Características Implementadas

1. **Detección de Sistema**
   - Verifica Ubuntu 22.04/24.04
   - Comprueba arquitectura (x64/arm64)
   - Valida ejecución como root

2. **Instalación de Dependencias**
   ```bash
   # Node.js desde NodeSource
   curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
   apt-get install -y nodejs
   
   # PostgreSQL
   apt-get install -y postgresql postgresql-contrib
   
   # Nginx y herramientas
   apt-get install -y nginx git curl
   
   # PM2 global
   npm install -g pm2
   ```

3. **Configuración de PostgreSQL**
   ```bash
   # Crear usuario y base de datos
   sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
   sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
   sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
   
   # Configurar autenticación md5 en pg_hba.conf
   sed -i 's/local   all             all                                     peer/local   all             all                                     md5/' /etc/postgresql/*/main/pg_hba.conf
   systemctl restart postgresql
   ```

4. **Creación de Usuario del Sistema**
   ```bash
   useradd -r -m -s /bin/bash $APP_USER
   mkdir -p /var/www/$APP_NAME
   chown -R $APP_USER:$APP_USER /var/www/$APP_NAME
   ```

5. **Clonación y Configuración**
   ```bash
   # Configurar git safe.directory
   git config --global --add safe.directory /var/www/$APP_NAME
   
   # Clonar repositorio
   sudo -u $APP_USER git clone $REPO_URL /var/www/$APP_NAME
   
   # Instalar dependencias
   cd /var/www/$APP_NAME
   sudo -u $APP_USER npm install
   ```

6. **Variables de Entorno (.env)**
   ```bash
   cat > /var/www/$APP_NAME/.env << EOF
   DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME
   SESSION_SECRET=$(openssl rand -base64 32)
   NODE_ENV=production
   PORT=$APP_PORT
   EOF
   chown $APP_USER:$APP_USER /var/www/$APP_NAME/.env
   chmod 600 /var/www/$APP_NAME/.env
   ```

7. **Migraciones de Base de Datos**
   ```bash
   cd /var/www/$APP_NAME
   sudo -u $APP_USER npm run db:push
   ```

8. **Configuración de PM2**
   ```bash
   # ecosystem.config.js
   cat > /var/www/$APP_NAME/ecosystem.config.js << EOF
   module.exports = {
     apps: [{
       name: '$APP_NAME',
       script: 'npm',
       args: 'start',
       cwd: '/var/www/$APP_NAME',
       env: {
         NODE_ENV: 'production',
         PORT: $APP_PORT
       }
     }]
   };
   EOF
   
   # Iniciar con PM2
   sudo -u $APP_USER pm2 start ecosystem.config.js
   sudo -u $APP_USER pm2 save
   
   # Configurar inicio automático
   env PATH=$PATH:/usr/bin pm2 startup systemd -u $APP_USER --hp /home/$APP_USER
   ```

9. **Configuración de Nginx**
   ```bash
   cat > /etc/nginx/sites-available/$APP_NAME << EOF
   server {
       listen 80;
       server_name $DOMAIN _;
       
       location / {
           proxy_pass http://127.0.0.1:$APP_PORT;
           proxy_http_version 1.1;
           proxy_set_header Upgrade \$http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host \$host;
           proxy_set_header X-Real-IP \$remote_addr;
           proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto \$scheme;
           proxy_cache_bypass \$http_upgrade;
       }
   }
   EOF
   
   ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
   rm -f /etc/nginx/sites-enabled/default
   nginx -t && systemctl reload nginx
   ```

10. **Firewall (UFW)**
    ```bash
    ufw allow ssh
    ufw allow 'Nginx Full'
    ufw --force enable
    ```

11. **SSL con Let's Encrypt (opcional)**
    ```bash
    apt-get install -y certbot python3-certbot-nginx
    certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m $EMAIL
    ```

---

## Estructura del Script install.sh

```bash
#!/bin/bash
set -e

#######################################
# CONFIGURACIÓN - PERSONALIZAR AQUÍ
#######################################
APP_NAME="miapp"
APP_USER="miapp"
APP_PORT="5000"
REPO_URL="https://github.com/usuario/repo.git"
DB_NAME="miapp_db"
DB_USER="miapp_user"
DB_PASS="CAMBIAR_ESTA_CONTRASEÑA"
DOMAIN=""  # Dejar vacío si no hay dominio

#######################################
# COLORES PARA OUTPUT
#######################################
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[*]${NC} $1"; }
print_success() { echo -e "${GREEN}[✓]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
print_error() { echo -e "${RED}[✗]${NC} $1"; }

#######################################
# VERIFICACIONES INICIALES
#######################################
if [ "$EUID" -ne 0 ]; then
    print_error "Este script debe ejecutarse como root"
    exit 1
fi

# Verificar Ubuntu
if ! grep -q "Ubuntu" /etc/os-release; then
    print_error "Este script está diseñado para Ubuntu"
    exit 1
fi

#######################################
# INSTALACIÓN
#######################################
print_status "Actualizando sistema..."
apt-get update && apt-get upgrade -y

print_status "Instalando Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

print_status "Instalando PostgreSQL..."
apt-get install -y postgresql postgresql-contrib

print_status "Instalando Nginx y herramientas..."
apt-get install -y nginx git curl

print_status "Instalando PM2..."
npm install -g pm2

# ... (continuar con el resto de la instalación)

#######################################
# RESUMEN FINAL
#######################################
echo ""
echo "=========================================="
echo -e "${GREEN}¡INSTALACIÓN COMPLETADA!${NC}"
echo "=========================================="
echo ""
echo "Aplicación: $APP_NAME"
echo "URL: http://$(hostname -I | awk '{print $1}'):$APP_PORT"
echo "Usuario del sistema: $APP_USER"
echo "Base de datos: $DB_NAME"
echo ""
echo "Comandos útiles:"
echo "  sudo -u $APP_USER pm2 status"
echo "  sudo -u $APP_USER pm2 logs $APP_NAME"
echo "  sudo -u $APP_USER pm2 restart $APP_NAME"
echo ""
```

---

## Checklist de Verificación

Antes de ejecutar el instalador, verifica:

- [ ] El servidor tiene Ubuntu 22.04 o 24.04
- [ ] Tienes acceso root o sudo
- [ ] El puerto de la aplicación está disponible
- [ ] El repositorio es accesible (público o con token)
- [ ] Los puertos 80/443 están abiertos en el firewall externo
- [ ] Tienes las credenciales de base de datos definidas

## Comandos de Diagnóstico

```bash
# Ver estado de la aplicación
sudo -u [usuario] pm2 status

# Ver logs de la aplicación
sudo -u [usuario] pm2 logs [app_name]

# Ver logs de Nginx
tail -f /var/log/nginx/error.log

# Ver estado de PostgreSQL
systemctl status postgresql

# Probar conexión a base de datos
psql -U [db_user] -d [db_name] -h localhost -W

# Reiniciar servicios
sudo -u [usuario] pm2 restart [app_name]
systemctl restart nginx
systemctl restart postgresql
```

## Solución de Problemas Comunes

| Problema | Solución |
|----------|----------|
| Error de conexión a BD | Verificar pg_hba.conf tiene md5 en lugar de peer |
| PM2 no inicia al reiniciar | Ejecutar `pm2 startup` y `pm2 save` |
| Nginx 502 Bad Gateway | Verificar que la app está corriendo en el puerto correcto |
| Permission denied en git | Agregar safe.directory: `git config --global --add safe.directory /ruta` |
| npm install falla | Verificar permisos y ejecutar como usuario de la app, no root |

---

## Notas Adicionales

### Para Cloudflare Tunnel (alternativa a abrir puertos)

Si no puedes abrir puertos en tu red, usa Cloudflare Tunnel:

```bash
# Instalar cloudflared
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
dpkg -i cloudflared.deb

# Autenticar
cloudflared tunnel login

# Crear túnel
cloudflared tunnel create [nombre-tunel]

# Configurar y ejecutar
cloudflared tunnel route dns [nombre-tunel] [subdominio.tudominio.com]
cloudflared tunnel run [nombre-tunel]
```

### Para Repositorios Privados

Usa un token de acceso personal de GitHub:

```bash
git clone https://[TOKEN]@github.com/usuario/repo-privado.git
```

O configura SSH keys para el usuario de la aplicación.
