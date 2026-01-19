#!/bin/bash
# ==============================================================================
# Audivia - Script de Instalación Desatendida para Ubuntu Server
# ==============================================================================
# Uso: curl -fsSL https://raw.githubusercontent.com/innovafpiesmmg/audivia/main/install.sh | sudo bash
# ==============================================================================

set -e

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
CONFIG_DIR="/etc/$APP_NAME"
NODE_VERSION="20"
APP_PORT="5000"
APP_USER="audivia"
DB_NAME="audivia"
DB_USER="audivia"

echo ""
echo "=============================================="
echo "   AUDIVIA - Instalación Desatendida"
echo "=============================================="
echo ""

if [ "$EUID" -ne 0 ]; then
    print_error "Este script debe ejecutarse como root"
    exit 1
fi

# ==============================================================================
# VERIFICAR INSTALACIÓN EXISTENTE
# ==============================================================================
IS_UPDATE=false
if [ -f "$CONFIG_DIR/env" ]; then
    IS_UPDATE=true
    print_status "Detectada instalación existente. Modo: ACTUALIZACIÓN"
    source "$CONFIG_DIR/env"
else
    print_status "Modo: INSTALACIÓN NUEVA"
    DB_PASS=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24)
    SESSION_SECRET=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 32)
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
print_status "Instalando dependencias..."
apt-get install -y -qq curl wget git build-essential ca-certificates gnupg lsb-release nginx
apt-mark manual nginx > /dev/null 2>&1 || true
systemctl enable nginx
print_success "Dependencias instaladas"

# ==============================================================================
# INSTALACIÓN DE NODE.JS
# ==============================================================================
print_status "Instalando Node.js $NODE_VERSION..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - > /dev/null 2>&1
    apt-get install -y -qq nodejs
fi
chmod 755 /usr/bin/node 2>/dev/null || true
chmod 755 /usr/bin/npm 2>/dev/null || true
print_success "Node.js $(node --version) instalado"

# ==============================================================================
# INSTALACIÓN DE POSTGRESQL
# ==============================================================================
print_status "Instalando PostgreSQL..."
if ! command -v psql &> /dev/null; then
    apt-get install -y -qq postgresql postgresql-contrib
fi
systemctl start postgresql
systemctl enable postgresql
print_success "PostgreSQL instalado"

# Configurar autenticación
PG_HBA=$(find /etc/postgresql -name "pg_hba.conf" 2>/dev/null | head -1)
if [ -n "$PG_HBA" ]; then
    sed -i 's/local   all             all                                     peer/local   all             all                                     md5/' "$PG_HBA"
    sed -i 's/local   all             all                                     scram-sha-256/local   all             all                                     md5/' "$PG_HBA"
    systemctl restart postgresql
fi

# Crear base de datos (solo instalación nueva)
if [ "$IS_UPDATE" = false ]; then
    print_status "Configurando base de datos..."
    sudo -u postgres psql -c "DROP DATABASE IF EXISTS $DB_NAME;" > /dev/null 2>&1 || true
    sudo -u postgres psql -c "DROP USER IF EXISTS $DB_USER;" > /dev/null 2>&1 || true
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" > /dev/null 2>&1
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" > /dev/null 2>&1
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" > /dev/null 2>&1
    print_success "Base de datos creada"
fi

# ==============================================================================
# PM2
# ==============================================================================
print_status "Instalando PM2..."
npm install -g pm2 > /dev/null 2>&1
print_success "PM2 instalado"

# ==============================================================================
# USUARIO DE APLICACIÓN
# ==============================================================================
if ! id "$APP_USER" &>/dev/null; then
    useradd --system --create-home --shell /bin/bash $APP_USER
fi
print_success "Usuario '$APP_USER' listo"

# ==============================================================================
# CONFIGURACIÓN PERSISTENTE (formato systemd EnvironmentFile)
# ==============================================================================
mkdir -p "$CONFIG_DIR"
chmod 700 "$CONFIG_DIR"

DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"

# Formato sin comillas para systemd EnvironmentFile
cat > "$CONFIG_DIR/env" << EOF
NODE_ENV=production
PORT=$APP_PORT
DATABASE_URL=$DATABASE_URL
SESSION_SECRET=$SESSION_SECRET
EOF
chmod 600 "$CONFIG_DIR/env"
print_success "Configuración guardada en $CONFIG_DIR"

# ==============================================================================
# CLONAR O ACTUALIZAR REPOSITORIO
# ==============================================================================
git config --global --add safe.directory "$APP_DIR"
sudo -u $APP_USER git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true

if [ -d "$APP_DIR/.git" ]; then
    print_status "Actualizando código..."
    cd "$APP_DIR"
    git fetch origin > /dev/null 2>&1
    git reset --hard origin/main > /dev/null 2>&1
else
    print_status "Descargando código..."
    rm -rf "$APP_DIR" 2>/dev/null || true
    git clone --depth 1 "$GITHUB_REPO" "$APP_DIR" > /dev/null 2>&1
fi
chown -R $APP_USER:$APP_USER "$APP_DIR"
print_success "Código listo"

# ==============================================================================
# DEPENDENCIAS Y BUILD
# ==============================================================================
cd "$APP_DIR"
print_status "Instalando dependencias npm..."
sudo -u $APP_USER npm install > /dev/null 2>&1
print_success "Dependencias instaladas"

print_status "Compilando aplicación..."
sudo -u $APP_USER npm run build > /dev/null 2>&1
print_success "Aplicación compilada"

# ==============================================================================
# ARCHIVO .ENV
# ==============================================================================
cat > "$APP_DIR/.env" << EOF
NODE_ENV=production
PORT=$APP_PORT
DATABASE_URL=$DATABASE_URL
SESSION_SECRET=$SESSION_SECRET
EOF
chown $APP_USER:$APP_USER "$APP_DIR/.env"
chmod 600 "$APP_DIR/.env"

# ==============================================================================
# MIGRACIONES
# ==============================================================================
print_status "Ejecutando migraciones..."
cd "$APP_DIR"
export DATABASE_URL="$DATABASE_URL"
sudo -u $APP_USER -E npm run db:push > /dev/null 2>&1 || true
print_success "Base de datos migrada"

# ==============================================================================
# SERVICIO SYSTEMD (PRINCIPAL - SOBREVIVE REINICIOS)
# ==============================================================================
print_status "Configurando servicio del sistema..."

cat > "/etc/systemd/system/audivia.service" << EOF
[Unit]
Description=Audivia Audiobook Platform
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$CONFIG_DIR/env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable audivia
systemctl restart audivia
print_success "Servicio audivia configurado"

# ==============================================================================
# NGINX
# ==============================================================================
print_status "Configurando Nginx..."

cat > "/etc/nginx/sites-available/$APP_NAME" << EOF
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
    }
}
EOF

ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t > /dev/null 2>&1
systemctl restart nginx
print_success "Nginx configurado"

# ==============================================================================
# FIREWALL
# ==============================================================================
if command -v ufw &> /dev/null; then
    ufw --force enable > /dev/null 2>&1 || true
    ufw allow ssh > /dev/null 2>&1
    ufw allow 'Nginx Full' > /dev/null 2>&1
fi

# ==============================================================================
# CLOUDFLARE TUNNEL (OPCIONAL)
# ==============================================================================
CLOUDFLARE_CONFIGURED=false

# Verificar si ya existe configuración de Cloudflare
if [ -f "/etc/cloudflared/config.yml" ] || systemctl is-active --quiet cloudflared 2>/dev/null; then
    print_status "Cloudflare Tunnel ya está configurado"
    CLOUDFLARE_CONFIGURED=true
fi

# Preguntar por token si se proporciona como variable de entorno o argumento
if [ -n "$CLOUDFLARE_TOKEN" ]; then
    CF_TOKEN="$CLOUDFLARE_TOKEN"
elif [ "$CLOUDFLARE_CONFIGURED" = false ]; then
    echo ""
    echo "=============================================="
    echo "  CLOUDFLARE TUNNEL (Opcional)"
    echo "=============================================="
    echo ""
    echo "  Cloudflare Tunnel permite acceder a tu aplicación"
    echo "  desde Internet sin abrir puertos en tu router."
    echo ""
    echo "  Para obtener un token:"
    echo "  1. Ve a https://one.dash.cloudflare.com"
    echo "  2. Networks > Tunnels > Create a tunnel"
    echo "  3. Selecciona 'Cloudflared' y copia el token"
    echo ""
    read -p "  Ingresa el token de Cloudflare (o Enter para omitir): " CF_TOKEN
fi

if [ -n "$CF_TOKEN" ] && [ "$CLOUDFLARE_CONFIGURED" = false ]; then
    print_status "Configurando Cloudflare Tunnel..."
    
    # Instalar cloudflared
    if ! command -v cloudflared &> /dev/null; then
        curl -L --output /tmp/cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb 2>/dev/null
        dpkg -i /tmp/cloudflared.deb > /dev/null 2>&1
        rm /tmp/cloudflared.deb
    fi
    
    # Instalar el servicio con el token
    cloudflared service install "$CF_TOKEN" > /dev/null 2>&1 || true
    
    # Habilitar e iniciar
    systemctl enable cloudflared > /dev/null 2>&1 || true
    systemctl start cloudflared > /dev/null 2>&1 || true
    
    # Habilitar cookies seguras (Cloudflare provee HTTPS)
    if [ -f "$CONFIG_DIR/env" ]; then
        if ! grep -q "SECURE_COOKIES" "$CONFIG_DIR/env"; then
            echo "SECURE_COOKIES=true" >> "$CONFIG_DIR/env"
        else
            sed -i 's/SECURE_COOKIES=.*/SECURE_COOKIES=true/' "$CONFIG_DIR/env"
        fi
    fi
    
    CLOUDFLARE_CONFIGURED=true
    print_success "Cloudflare Tunnel configurado"
    print_status "Configura el hostname en el dashboard de Cloudflare"
fi

# ==============================================================================
# CREDENCIALES
# ==============================================================================
SERVER_IP=$(hostname -I | awk '{print $1}')

CF_INFO=""
if [ "$CLOUDFLARE_CONFIGURED" = true ]; then
    CF_INFO="
Cloudflare Tunnel: Configurado
  Estado:     systemctl status cloudflared
  Logs:       journalctl -u cloudflared -f
"
fi

cat > "/root/audivia-credentials.txt" << EOF
============================================
AUDIVIA - Credenciales
============================================
Fecha: $(date)
URL Local: http://$SERVER_IP
$CF_INFO
Base de datos:
  Nombre: $DB_NAME
  Usuario: $DB_USER
  Contraseña: $DB_PASS

Session Secret: $SESSION_SECRET
Directorio: $APP_DIR
Configuración: $CONFIG_DIR

Comandos:
  Estado:     systemctl status audivia
  Logs:       journalctl -u audivia -f
  Reiniciar:  systemctl restart audivia
  Actualizar: cd $APP_DIR && git pull && npm run build && systemctl restart audivia
============================================
EOF
chmod 600 /root/audivia-credentials.txt

# ==============================================================================
# VERIFICACIÓN
# ==============================================================================
sleep 5
if systemctl is-active --quiet audivia; then
    print_success "Audivia está funcionando"
else
    print_warning "Verificando..."
    systemctl status audivia --no-pager || true
fi

echo ""
echo "=============================================="
echo -e "${GREEN}   INSTALACIÓN COMPLETADA${NC}"
echo "=============================================="
echo ""
echo "  URL Local: http://$SERVER_IP"
if [ "$CLOUDFLARE_CONFIGURED" = true ]; then
echo ""
echo "  Cloudflare Tunnel: Configurado"
echo "  Configura el hostname en el dashboard de Cloudflare"
echo "  apuntando a http://localhost:$APP_PORT"
fi
echo ""
echo "  Comandos útiles:"
echo "  - Estado:     systemctl status audivia"
echo "  - Logs:       journalctl -u audivia -f"
echo "  - Reiniciar:  systemctl restart audivia"
if [ "$CLOUDFLARE_CONFIGURED" = true ]; then
echo "  - Tunnel:     systemctl status cloudflared"
fi
echo ""
echo "  Credenciales: /root/audivia-credentials.txt"
echo ""
