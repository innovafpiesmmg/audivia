# Audivia - Plataforma Premium de Audiolibros

Audivia es una plataforma completa de audiolibros con monetización dual, diseñada para ofrecer una experiencia premium tanto en web como en dispositivos móviles.

**Desarrollado por:** Atreyu Servicios Digitales

---

## Características Principales

### Para Oyentes
- Catálogo de Audiolibros: Explora y descubre audiolibros organizados por categorías
- Soporte de Series: Organiza audiolibros por nombre de serie y número de orden
- Ordenamiento Múltiple: Ordena por recientes, serie, título o autor
- Reproductor de Audio Nativo: Reproductor HTML5 con controles de velocidad, salto y progreso
- Biblioteca Personal: Gestiona tus compras, favoritos y progreso de escucha
- Listas de Reproducción: Crea y organiza tus propias listas de capítulos
- Feed RSS: Compatible con AntennaPod y otros reproductores de podcasts
- Versión Móvil Optimizada: Experiencia nativa sin necesidad de app externa

### Monetización
- Compras Individuales: Compra audiolibros específicos con pago único
- Suscripciones: Acceso completo al catálogo con planes mensuales
- Períodos de Prueba: Configura días de prueba gratuitos en suscripciones
- Códigos de Descuento: Sistema completo de cupones con porcentaje o monto fijo
- Carrito de Compras: Añade múltiples audiolibros antes de pagar

### Pagos
- PayPal Integrado: Procesamiento seguro de pagos con PayPal
- Facturación Automática: Generación de facturas PDF con datos fiscales
- Perfiles de Facturación: Los usuarios pueden guardar sus datos de facturación

### Administración
- Panel de Control: Dashboard con métricas de ventas y usuarios
- Gestión de Audiolibros: Crear, editar y organizar audiolibros y capítulos
- Gestión de Series: Asignar audiolibros a series con orden personalizado
- Gestión de Usuarios: Administrar cuentas, roles y permisos
- Importación Masiva: Importar audiolibros desde YouTube o archivos locales
- Sincronización GitHub: Backup y sincronización del código con GitHub
- Configuración de Email: SMTP configurable para notificaciones
- Códigos de Descuento: Crear y gestionar promociones

---

## Requisitos del Sistema

- **Node.js:** v18 o superior (recomendado v20)
- **Base de Datos:** PostgreSQL 14+ (local o Neon Database en la nube)
- **Sistema Operativo:** Ubuntu 18.04, 20.04, 22.04 o 24.04 (para instalación automática)
- **RAM:** Mínimo 1GB, recomendado 2GB+
- **Almacenamiento:** 10GB+ disponible

---

## Instalación Rápida (Ubuntu Server)

### Instalación Desatendida con un Solo Comando

Ejecuta este comando en tu servidor Ubuntu (18.04, 20.04, 22.04 o 24.04):

```bash
curl -fsSL https://raw.githubusercontent.com/innovafpiesmmg/audivia/main/install.sh | sudo bash
```

O si prefieres usar wget:

```bash
wget -qO- https://raw.githubusercontent.com/innovafpiesmmg/audivia/main/install.sh | sudo bash
```

### El script automáticamente:
- Instala Node.js 20, PostgreSQL y todas las dependencias
- Configura autenticación PostgreSQL (md5)
- Crea la base de datos y usuario con permisos apropiados
- Descarga e instala Audivia desde GitHub
- Genera SESSION_SECRET automáticamente
- Ejecuta las migraciones de base de datos
- Configura PM2 para inicio automático
- Instala y configura Nginx como proxy reverso
- Configura el firewall (UFW)

### Después de la instalación:
1. Accede a `http://tu-ip-servidor`
2. Verás el asistente de configuración para crear tu cuenta de administrador
3. Las credenciales se guardan en `/root/audivia-credentials.txt`

### Comandos útiles post-instalación:
```bash
# Ver estado de la aplicación
sudo -u audivia pm2 status

# Ver logs en tiempo real
sudo -u audivia pm2 logs audivia

# Reiniciar la aplicación
sudo -u audivia pm2 restart audivia

# Actualizar desde GitHub
cd /var/www/audivia && git pull && sudo -u audivia pm2 restart audivia
```

---

## Instalación Manual

### 1. Clonar el Repositorio
```bash
git clone https://github.com/innovafpiesmmg/audivia.git
cd audivia

# Importante: configurar safe.directory si ejecutas como root
git config --global --add safe.directory /var/www/audivia
```

### 2. Instalar Dependencias
```bash
npm install
```

### 3. Configurar Base de Datos PostgreSQL
```bash
# Crear usuario y base de datos
sudo -u postgres psql -c "CREATE USER audivia WITH PASSWORD 'tu_contraseña';"
sudo -u postgres psql -c "CREATE DATABASE audivia OWNER audivia;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE audivia TO audivia;"
```

### 4. Configurar Variables de Entorno
Crea un archivo `.env` con las siguientes variables:

```env
# Servidor
NODE_ENV=production
PORT=5000

# Base de Datos (obligatorio)
DATABASE_URL=postgresql://audivia:tu_contraseña@localhost:5432/audivia

# Sesiones (se genera automáticamente si no se proporciona)
SESSION_SECRET=tu_secreto_aleatorio_de_32_caracteres

# PayPal (para pagos)
PAYPAL_CLIENT_ID=tu_client_id
PAYPAL_CLIENT_SECRET=tu_client_secret
PAYPAL_MODE=sandbox  # o 'live' para producción

# Email (para notificaciones)
SMTP_HOST=smtp.tuservidor.com
SMTP_PORT=587
SMTP_USER=tu_usuario
SMTP_PASS=tu_contraseña
SMTP_FROM=noreply@tudominio.com
```

### 5. Ejecutar Migraciones
```bash
npm run db:push
```

### 6. Iniciar la Aplicación

**Desarrollo:**
```bash
npm run dev
```

**Producción con PM2:**
```bash
pm2 start npm --name audivia -- run dev
pm2 save
```

### 7. Configuración Inicial
Al acceder por primera vez a la aplicación, se mostrará un asistente de configuración que te guiará para:
- Verificar la conexión a la base de datos
- Crear la cuenta de administrador

---

## Base de Datos

### Soporte Dual: Local y Neon (Cloud)

Audivia detecta automáticamente el tipo de base de datos:

- **PostgreSQL Local:** Usa el driver `pg` estándar para conexiones locales
- **Neon Database (Cloud):** Usa el driver `@neondatabase/serverless` con WebSockets

La detección es automática basándose en el `DATABASE_URL`:
- URLs con `neon.tech` usan el driver de Neon
- Otras URLs usan el driver pg estándar

### Migraciones
```bash
# Aplicar cambios al esquema
npm run db:push

# Ver estado de la base de datos (GUI)
npm run db:studio
```

---

## Estructura del Proyecto

```
audivia/
├── client/                 # Frontend React
│   ├── src/
│   │   ├── components/     # Componentes reutilizables
│   │   ├── pages/          # Páginas de la aplicación
│   │   ├── hooks/          # Custom hooks
│   │   └── lib/            # Utilidades
│   └── public/             # Archivos estáticos (logo, etc.)
├── server/                 # Backend Express
│   ├── routes.ts           # Endpoints API
│   ├── storage.ts          # Capa de almacenamiento
│   ├── db.ts               # Configuración de base de datos
│   ├── paypal-service.ts   # Integración PayPal
│   ├── email.ts            # Servicio de email
│   ├── github-service.ts   # Sincronización con GitHub
│   └── invoice-service.ts  # Generación de facturas
├── shared/                 # Código compartido
│   └── schema.ts           # Esquemas de base de datos (Drizzle)
└── install.sh              # Script de instalación automática
```

---

## API Endpoints

### Autenticación
- `POST /api/auth/register` - Registro de usuarios
- `POST /api/auth/login` - Inicio de sesión
- `POST /api/auth/logout` - Cerrar sesión
- `GET /api/auth/me` - Usuario actual

### Audiolibros
- `GET /api/audiobooks` - Listar audiolibros
- `GET /api/audiobooks/:id` - Detalle de audiolibro
- `GET /api/chapters/:id` - Detalle de capítulo

### Biblioteca
- `GET /api/library/purchases` - Compras del usuario
- `GET /api/library/favorites` - Favoritos
- `POST /api/library/favorites/:id` - Añadir a favoritos

### Carrito y Pagos
- `GET /api/cart` - Ver carrito
- `POST /api/cart/add` - Añadir al carrito
- `POST /api/paypal/create-cart-order` - Crear orden PayPal
- `POST /api/paypal/capture-cart-order` - Capturar pago

### Suscripciones
- `GET /api/subscription-plans` - Planes disponibles
- `POST /api/subscriptions/subscribe` - Suscribirse
- `GET /api/subscriptions/active` - Suscripción activa

### RSS Feeds
- `GET /api/rss/user/:userId` - Feed RSS personal para AntennaPod

---

## Tecnologías Utilizadas

### Frontend
- React 18 con TypeScript
- Vite como bundler
- TanStack Query para estado del servidor
- Tailwind CSS + shadcn/ui para estilos
- Wouter para routing

### Backend
- Express.js con TypeScript
- Drizzle ORM para base de datos
- PostgreSQL (local o Neon Database)
- Passport.js para autenticación
- PM2 para gestión de procesos

### Integraciones
- PayPal SDK para pagos
- Nodemailer para emails
- PDFKit para facturas
- Octokit para sincronización con GitHub

---

## Versión Móvil

La versión móvil está optimizada para dispositivos táctiles y ofrece:
- Navegación por tabs (Inicio, Explorar, Biblioteca, Carrito)
- Reproductor de audio integrado
- Checkout completo sin salir de la app
- Tema oscuro con colores premium

Accede a la versión móvil en: `/mobile`

---

## Variables de Entorno

| Variable | Descripción | Requerido | Ejemplo |
|----------|-------------|-----------|---------|
| `DATABASE_URL` | URL de conexión a PostgreSQL | Sí | `postgresql://user:pass@localhost:5432/audivia` |
| `SESSION_SECRET` | Secreto para sesiones (auto-generado si no existe) | No | `tu-secreto-aleatorio-32-chars` |
| `PORT` | Puerto de la aplicación | No | `5000` (default) |
| `NODE_ENV` | Entorno de ejecución | No | `production` |
| `PAYPAL_CLIENT_ID` | Client ID de PayPal | Para pagos | `AXxx...` |
| `PAYPAL_CLIENT_SECRET` | Secret de PayPal | Para pagos | `EBxx...` |
| `PAYPAL_MODE` | Modo de PayPal | Para pagos | `sandbox` o `live` |
| `SMTP_HOST` | Servidor SMTP | Para emails | `smtp.gmail.com` |
| `SMTP_PORT` | Puerto SMTP | Para emails | `587` |
| `SMTP_USER` | Usuario SMTP | Para emails | `tu@email.com` |
| `SMTP_PASS` | Contraseña SMTP | Para emails | `tu-contraseña` |
| `SMTP_FROM` | Email remitente | Para emails | `noreply@tudominio.com` |

---

## Sincronización con GitHub

Audivia incluye sincronización bidireccional con GitHub:

1. **Desde Admin > GitHub:** Conecta tu cuenta de GitHub
2. **Sincronizar:** Sube todos los archivos (código e imágenes) al repositorio
3. **En el servidor:** Ejecuta `git pull` para obtener las actualizaciones

### Actualizar servidor desde GitHub:
```bash
cd /var/www/audivia
git config --global --add safe.directory /var/www/audivia
git pull origin main
sudo -u audivia pm2 restart audivia
```

---

## Solución de Problemas

### Error de permisos de Git
```bash
git config --global --add safe.directory /var/www/audivia
```

### Error de conexión a PostgreSQL
Verificar que el archivo `pg_hba.conf` usa autenticación `md5`:
```bash
sudo nano /etc/postgresql/*/main/pg_hba.conf
# Cambiar 'peer' por 'md5' en conexiones locales
sudo systemctl restart postgresql
```

### Aplicación no inicia
```bash
# Ver logs
sudo -u audivia pm2 logs audivia

# Reiniciar
sudo -u audivia pm2 restart audivia
```

### Logo no se muestra
Verificar que el archivo existe y tiene permisos correctos:
```bash
ls -la /var/www/audivia/client/public/logo.png
```

---

## Comandos de Desarrollo

```bash
# Instalar dependencias
npm install

# Desarrollo con hot-reload
npm run dev

# Ejecutar migraciones de BD
npm run db:push

# Ver estado de BD con Drizzle Studio
npm run db:studio
```

---

## Licencia

Todos los derechos reservados - Atreyu Servicios Digitales

---

## Soporte

Para soporte técnico, contacta a: soporte@audivia.com
