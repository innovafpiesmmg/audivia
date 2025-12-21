#!/bin/bash

###############################################################################
# Podcast Platform - Ubuntu Installation Script
# 
# This script automates the installation and setup of the podcast platform
# on Ubuntu Server (20.04+)
#
# Usage: sudo bash scripts/install.sh
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}Error: This script must be run as root or with sudo${NC}"
  echo "Usage: sudo bash scripts/install.sh"
  exit 1
fi

# Get the actual user who invoked sudo
ACTUAL_USER=${SUDO_USER:-$USER}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Podcast Platform Installation${NC}"
echo -e "${BLUE}========================================${NC}"
echo

# Function to print status messages
print_status() {
  echo -e "${BLUE}[*]${NC} $1"
}

print_success() {
  echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
  echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}[!]${NC} $1"
}

# Get installation directory (current directory)
INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$INSTALL_DIR"

print_status "Installation directory: $INSTALL_DIR"
echo

###############################################################################
# 1. Install system dependencies
###############################################################################

print_status "Installing system dependencies..."

apt-get update
apt-get install -y curl git build-essential postgresql postgresql-contrib

print_success "System dependencies installed"
echo

###############################################################################
# 2. Install Node.js (if not already installed)
###############################################################################

if ! command -v node &> /dev/null; then
  print_status "Installing Node.js 20..."
  
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  
  print_success "Node.js installed: $(node --version)"
else
  print_success "Node.js already installed: $(node --version)"
fi

echo

###############################################################################
# 3. Install npm/pnpm (if needed)
###############################################################################

if ! command -v npm &> /dev/null; then
  print_error "npm not found. Please install npm manually."
  exit 1
fi

print_success "npm installed: $(npm --version)"
echo

###############################################################################
# 4. PostgreSQL setup
###############################################################################

print_status "Configuring PostgreSQL..."

# Start PostgreSQL service
systemctl start postgresql
systemctl enable postgresql

# Generate random database password
DB_PASSWORD=$(openssl rand -base64 32)
DB_NAME="podcast_platform"
DB_USER="podcast_user"

# Create database and user
sudo -u postgres psql <<EOF
-- Drop database if exists (for clean reinstall)
DROP DATABASE IF EXISTS $DB_NAME;
DROP USER IF EXISTS $DB_USER;

-- Create new user and database
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE $DB_NAME OWNER $DB_USER;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;

-- Connect to database and grant schema privileges
\c $DB_NAME
GRANT ALL ON SCHEMA public TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;
EOF

print_success "PostgreSQL database created"
print_success "Database: $DB_NAME"
print_success "User: $DB_USER"
echo

###############################################################################
# 5. Create uploads directories
###############################################################################

print_status "Creating uploads directories..."

mkdir -p "$INSTALL_DIR/uploads/images"
mkdir -p "$INSTALL_DIR/uploads/audio"

# Set proper permissions
chown -R "$ACTUAL_USER:$ACTUAL_USER" "$INSTALL_DIR/uploads"
chmod -R 755 "$INSTALL_DIR/uploads"

print_success "Uploads directories created"
echo

###############################################################################
# 6. Generate .env.production file
###############################################################################

print_status "Generating .env.production file..."

# Generate random session secret
SESSION_SECRET=$(openssl rand -base64 48)

# Generate random admin password
ADMIN_PASSWORD=$(openssl rand -base64 16)

cat > "$INSTALL_DIR/.env.production" <<EOF
# Database Configuration
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME
PGHOST=localhost
PGPORT=5432
PGDATABASE=$DB_NAME
PGUSER=$DB_USER
PGPASSWORD=$DB_PASSWORD

# Server Configuration
NODE_ENV=production
PORT=5000
SESSION_SECRET=$SESSION_SECRET

# Admin User (created on first run)
ADMIN_EMAIL=admin@localhost
ADMIN_PASSWORD=$ADMIN_PASSWORD

# Storage Configuration
STORAGE_PROVIDER=LOCAL
UPLOADS_ROOT=$INSTALL_DIR/uploads

# Public URL (CHANGE THIS TO YOUR DOMAIN)
PUBLIC_URL=http://localhost:5000

# Email Configuration (Optional - configure if needed)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_SECURE=false
# SMTP_USER=
# SMTP_PASS=
EOF

chown "$ACTUAL_USER:$ACTUAL_USER" "$INSTALL_DIR/.env.production"
chmod 600 "$INSTALL_DIR/.env.production"

print_success ".env.production created"
echo

###############################################################################
# 7. Install Node.js dependencies
###############################################################################

print_status "Installing Node.js dependencies..."

# Run npm install as the actual user (not root)
sudo -u "$ACTUAL_USER" npm ci --production=false

print_success "Node.js dependencies installed"
echo

###############################################################################
# 8. Run database migrations
###############################################################################

print_status "Running database migrations..."

# Run migrations as the actual user
sudo -u "$ACTUAL_USER" sh -c "export NODE_ENV=production && npm run db:push"

print_success "Database migrations completed"
echo

###############################################################################
# 9. Build the application
###############################################################################

print_status "Building the application..."

sudo -u "$ACTUAL_USER" npm run build

print_success "Application built successfully"
echo

###############################################################################
# 10. Create systemd service (optional)
###############################################################################

read -p "Do you want to create a systemd service to run the app automatically? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  print_status "Creating systemd service..."
  
  cat > /etc/systemd/system/podcast-platform.service <<EOF
[Unit]
Description=Podcast Platform
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=$ACTUAL_USER
WorkingDirectory=$INSTALL_DIR
Environment=NODE_ENV=production
EnvironmentFile=$INSTALL_DIR/.env.production
ExecStart=$(which node) $INSTALL_DIR/dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable podcast-platform
  systemctl start podcast-platform
  
  print_success "Systemd service created and started"
  print_status "Service status: systemctl status podcast-platform"
  print_status "View logs: journalctl -u podcast-platform -f"
else
  print_warning "Systemd service not created"
  print_status "To run manually: cd $INSTALL_DIR && npm start"
fi

echo

###############################################################################
# Installation Complete
###############################################################################

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Installation Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo
echo -e "${BLUE}Important Information:${NC}"
echo
echo -e "1. Admin Login Credentials:"
echo -e "   Email: ${GREEN}admin@localhost${NC}"
echo -e "   Password: ${GREEN}$ADMIN_PASSWORD${NC}"
echo
echo -e "2. Database:"
echo -e "   Name: ${GREEN}$DB_NAME${NC}"
echo -e "   User: ${GREEN}$DB_USER${NC}"
echo -e "   Password: ${GREEN}$DB_PASSWORD${NC}"
echo
echo -e "3. Application:"
echo -e "   Location: ${GREEN}$INSTALL_DIR${NC}"
echo -e "   Uploads: ${GREEN}$INSTALL_DIR/uploads${NC}"
echo
echo -e "4. Configuration:"
echo -e "   Environment file: ${GREEN}$INSTALL_DIR/.env.production${NC}"
echo
echo -e "${YELLOW}Next Steps:${NC}"
echo
echo "1. Edit .env.production and update PUBLIC_URL with your domain"
echo "2. Configure email settings in .env.production (optional)"
echo "3. Access the application at: http://localhost:5000"
echo "4. Login with the admin credentials shown above"
echo "5. IMPORTANT: Save the admin password somewhere safe!"
echo
echo -e "${YELLOW}Security Recommendations:${NC}"
echo
echo "1. Change the admin password after first login"
echo "2. Configure a firewall (ufw enable)"
echo "3. Set up HTTPS with Let's Encrypt/Nginx"
echo "4. Regular backups of database and uploads directory"
echo
print_success "Installation script completed successfully!"
