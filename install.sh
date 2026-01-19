#!/bin/bash
# ==============================================================================
# Audivia - Script de Instalación Desatendida para Ubuntu Server
# ==============================================================================
# Uso: curl -fsSL https://raw.githubusercontent.com/innovafpiesmmg/audivia/main/install.sh | sudo bash
# O:   wget -qO- https://raw.githubusercontent.com/innovafpiesmmg/audivia/main/install.sh | sudo bash
# ==============================================================================

set -e

# Colores para mensajes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[OK]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[AVISO]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ==============================================================================
# CONFIGURACIÓN
# ==============================================================================
APP_NAME="audivia"
GITHUB_REPO="https://github.com/innovafpiesmmg/audivia.git"
APP_DIR="/var/www/$APP_NAME"
NODE_VERSION="20"
APP_PORT="5000"
APP_USER="audivia"
DB_NAME="audivia"
DB_USER="audivia"
DB_PASS=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24)
SESSION_SECRET=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 32)

# ==============================================================================
# VERIFICACIONES INICIALES
# ==============================================================================
echo ""
echo "=============================================="
echo "   AUDIVIA - Instalación Desatendida"
echo "   Premium Audiobook Platform"
echo "=============================================="
echo ""

if [ "$EUID" -ne 0 ]; then
    print_error "Este script debe ejecutarse como root (usa sudo)"
    exit 1
fi

print_status "Detectando sistema operativo..."
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    VER=$VERSION_ID
    print_success "Sistema: $OS $VER"
else
    print_error "No se pudo detectar el sistema operativo"
    exit 1
fi

# ==============================================================================
# ACTUALIZACIÓN DEL SISTEMA
# ==============================================================================
print_status "Actualizando sistema..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
print_success "Sistema actualizado"

# ==============================================================================
# INSTALACIÓN DE DEPENDENCIAS
# ==============================================================================
print_status "Instalando dependencias del sistema..."
apt-get install -y -qq curl wget git build-essential ca-certificates gnupg lsb-release
print_success "Dependencias instaladas"

# ==============================================================================
# INSTALACIÓN DE NODE.JS
# ==============================================================================
print_status "Instalando Node.js $NODE_VERSION..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - > /dev/null 2>&1
    apt-get install -y -qq nodejs
fi
NODE_VER=$(node --version)
NPM_VER=$(npm --version)
print_success "Node.js $NODE_VER instalado (npm $NPM_VER)"

# ==============================================================================
# INSTALACIÓN DE POSTGRESQL
# ==============================================================================
print_status "Instalando PostgreSQL..."
if ! command -v psql &> /dev/null; then
    apt-get install -y -qq postgresql postgresql-contrib
fi
systemctl start postgresql
systemctl enable postgresql
print_success "PostgreSQL instalado y activo"

# Configurar autenticación PostgreSQL para conexiones locales con contraseña
print_status "Configurando autenticación PostgreSQL..."
PG_HBA=$(find /etc/postgresql -name "pg_hba.conf" 2>/dev/null | head -1)
if [ -n "$PG_HBA" ]; then
    # Backup del archivo original
    cp "$PG_HBA" "$PG_HBA.backup"
    
    # Cambiar autenticación de peer a md5 para conexiones locales
    sed -i 's/local   all             all                                     peer/local   all             all                                     md5/' "$PG_HBA"
    sed -i 's/local   all             all                                     scram-sha-256/local   all             all                                     md5/' "$PG_HBA"
    
    # Reiniciar PostgreSQL para aplicar cambios
    systemctl restart postgresql
    print_success "Autenticación PostgreSQL configurada (md5)"
else
    print_warning "No se encontró pg_hba.conf, usando configuración por defecto"
fi

# Configurar base de datos
print_status "Configurando base de datos..."
sudo -u postgres psql -c "DROP DATABASE IF EXISTS $DB_NAME;" > /dev/null 2>&1 || true
sudo -u postgres psql -c "DROP USER IF EXISTS $DB_USER;" > /dev/null 2>&1 || true
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" > /dev/null 2>&1
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" > /dev/null 2>&1
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" > /dev/null 2>&1
sudo -u postgres psql -c "ALTER USER $DB_USER CREATEDB;" > /dev/null 2>&1
print_success "Base de datos '$DB_NAME' creada"

# ==============================================================================
# INSTALACIÓN DE PM2
# ==============================================================================
print_status "Instalando PM2..."
npm install -g pm2 > /dev/null 2>&1
print_success "PM2 instalado"

# ==============================================================================
# CREAR USUARIO DE APLICACIÓN
# ==============================================================================
print_status "Creando usuario de aplicación..."
if ! id "$APP_USER" &>/dev/null; then
    useradd --system --create-home --shell /bin/bash $APP_USER
fi
print_success "Usuario '$APP_USER' creado"

# ==============================================================================
# CONFIGURAR GIT SAFE DIRECTORY
# ==============================================================================
print_status "Configurando permisos de Git..."
git config --global --add safe.directory "$APP_DIR"
sudo -u $APP_USER git config --global --add safe.directory "$APP_DIR"
print_success "Git safe.directory configurado"

# ==============================================================================
# CLONAR REPOSITORIO
# ==============================================================================
print_status "Descargando Audivia desde GitHub..."
if [ -d "$APP_DIR" ]; then
    rm -rf "$APP_DIR"
fi
git clone --depth 1 "$GITHUB_REPO" "$APP_DIR" > /dev/null 2>&1
chown -R $APP_USER:$APP_USER "$APP_DIR"
print_success "Código descargado en $APP_DIR"

# ==============================================================================
# INSTALAR DEPENDENCIAS NPM
# ==============================================================================
print_status "Instalando dependencias de la aplicación (esto puede tardar)..."
cd "$APP_DIR"
sudo -u $APP_USER npm install > /dev/null 2>&1
print_success "Dependencias instaladas"

# ==============================================================================
# CONFIGURAR VARIABLES DE ENTORNO
# ==============================================================================
print_status "Configurando variables de entorno..."
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"

cat > "$APP_DIR/.env" <<EOF
NODE_ENV=production
PORT=$APP_PORT
DATABASE_URL=$DATABASE_URL
SESSION_SECRET=$SESSION_SECRET
EOF

chown $APP_USER:$APP_USER "$APP_DIR/.env"
chmod 600 "$APP_DIR/.env"
print_success "Variables de entorno configuradas"

# ==============================================================================
# EJECUTAR MIGRACIONES DE BASE DE DATOS
# ==============================================================================
print_status "Ejecutando migraciones de base de datos..."
cd "$APP_DIR"

# Configurar variable de entorno para la migración
export DATABASE_URL="$DATABASE_URL"

# Ejecutar migraciones con drizzle-kit
sudo -u $APP_USER -E npm run db:push > /dev/null 2>&1 || {
    print_warning "Reintentando migraciones..."
    sleep 2
    sudo -u $APP_USER DATABASE_URL="$DATABASE_URL" npx drizzle-kit push > /dev/null 2>&1
}
print_success "Base de datos migrada"

# ==============================================================================
# CONFIGURAR PM2
# ==============================================================================
print_status "Configurando PM2..."

# Crear directorio de logs
mkdir -p "$APP_DIR/logs"
chown -R $APP_USER:$APP_USER "$APP_DIR/logs"

cat > "$APP_DIR/ecosystem.config.cjs" <<EOF
module.exports = {
  apps: [{
    name: '$APP_NAME',
    script: 'npm',
    args: 'run dev',
    cwd: '$APP_DIR',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: $APP_PORT,
      DATABASE_URL: '$DATABASE_URL',
      SESSION_SECRET: '$SESSION_SECRET'
    },
    error_file: '$APP_DIR/logs/error.log',
    out_file: '$APP_DIR/logs/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
EOF

chown $APP_USER:$APP_USER "$APP_DIR/ecosystem.config.cjs"

# Detener cualquier instancia previa
sudo -u $APP_USER pm2 delete $APP_NAME > /dev/null 2>&1 || true
sudo -u $APP_USER pm2 kill > /dev/null 2>&1 || true

# Iniciar aplicación
print_status "Iniciando aplicación con PM2..."
cd "$APP_DIR"
sudo -u $APP_USER pm2 start ecosystem.config.cjs > /dev/null 2>&1

# Esperar a que la aplicación inicie
sleep 5

# Verificar que la aplicación está corriendo
if sudo -u $APP_USER pm2 list | grep -q "$APP_NAME"; then
    print_success "Aplicación iniciada con PM2"
else
    print_warning "Verificando estado de la aplicación..."
    sudo -u $APP_USER pm2 list
fi

# Configurar inicio automático de PM2
print_status "Configurando inicio automático..."
env PATH=$PATH:/usr/bin pm2 startup systemd -u $APP_USER --hp /home/$APP_USER > /dev/null 2>&1 || true
sudo -u $APP_USER pm2 save > /dev/null 2>&1 || true
print_success "PM2 configurado para inicio automático"

# ==============================================================================
# INSTALAR Y CONFIGURAR NGINX
# ==============================================================================
print_status "Instalando Nginx..."
apt-get install -y -qq nginx

cat > "/etc/nginx/sites-available/$APP_NAME" <<EOF
server {
    listen 80;
    server_name _;

    client_max_body_size 500M;

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
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t > /dev/null 2>&1
systemctl restart nginx
systemctl enable nginx
print_success "Nginx configurado"

# ==============================================================================
# CONFIGURAR FIREWALL (OPCIONAL)
# ==============================================================================
print_status "Configurando firewall..."
if command -v ufw &> /dev/null; then
    ufw --force enable > /dev/null 2>&1 || true
    ufw allow ssh > /dev/null 2>&1
    ufw allow 'Nginx Full' > /dev/null 2>&1
    ufw allow $APP_PORT > /dev/null 2>&1
    print_success "Firewall configurado (SSH, HTTP/HTTPS y puerto $APP_PORT)"
else
    print_warning "UFW no instalado, saltando configuración de firewall"
fi

# ==============================================================================
# OBTENER IP DEL SERVIDOR
# ==============================================================================
SERVER_IP=$(hostname -I | awk '{print $1}')

# ==============================================================================
# GUARDAR CREDENCIALES
# ==============================================================================
cat > "/root/audivia-credentials.txt" <<EOF
============================================
AUDIVIA - Credenciales de Instalación
============================================
Fecha: $(date)
Servidor: $SERVER_IP
URL: http://$SERVER_IP

Base de datos:
  Nombre: $DB_NAME
  Usuario: $DB_USER
  Contraseña: $DB_PASS
  URL: $DATABASE_URL

Session Secret: $SESSION_SECRET

Directorio: $APP_DIR
Puerto: $APP_PORT
Usuario sistema: $APP_USER

Comandos útiles:
  Ver estado:    sudo -u $APP_USER pm2 status
  Ver logs:      sudo -u $APP_USER pm2 logs $APP_NAME
  Reiniciar:     sudo -u $APP_USER pm2 restart $APP_NAME
  Detener:       sudo -u $APP_USER pm2 stop $APP_NAME
  Actualizar:    cd $APP_DIR && git pull && sudo -u $APP_USER pm2 restart $APP_NAME
============================================
EOF
chmod 600 /root/audivia-credentials.txt

# ==============================================================================
# RESUMEN FINAL
# ==============================================================================
echo ""
echo "=============================================="
echo -e "${GREEN}   INSTALACIÓN COMPLETADA${NC}"
echo "=============================================="
echo ""
echo "  Audivia está instalado y funcionando."
echo ""
echo "  Accede a la aplicación en:"
echo -e "  ${BLUE}http://$SERVER_IP${NC}"
echo ""
echo "  La primera vez que accedas, verás el"
echo "  asistente de configuración para crear"
echo "  tu cuenta de administrador."
echo ""
echo "=============================================="
echo "  INFORMACIÓN DE LA INSTALACIÓN"
echo "=============================================="
echo "  Directorio: $APP_DIR"
echo "  Base de datos: $DB_NAME"
echo "  Usuario BD: $DB_USER"
echo "  Puerto: $APP_PORT"
echo ""
echo "  Comandos útiles:"
echo "  - Ver estado: sudo -u $APP_USER pm2 status"
echo "  - Ver logs: sudo -u $APP_USER pm2 logs $APP_NAME"
echo "  - Reiniciar: sudo -u $APP_USER pm2 restart $APP_NAME"
echo "  - Detener: sudo -u $APP_USER pm2 stop $APP_NAME"
echo "  - Actualizar: cd $APP_DIR && git pull && sudo -u $APP_USER pm2 restart $APP_NAME"
echo ""
echo "=============================================="
echo ""

print_success "Credenciales guardadas en /root/audivia-credentials.txt"
echo ""
