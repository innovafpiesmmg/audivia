# Audivia - Plataforma Premium de Audiolibros

Audivia es una plataforma completa de audiolibros con monetización dual, diseñada para ofrecer una experiencia premium tanto en web como en dispositivos móviles.

**Desarrollado por:** Atreyu Servicios Digitales

---

## Características Principales

### Para Oyentes
- Catálogo de Audiolibros: Explora y descubre audiolibros organizados por categorías
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
- Gestión de Usuarios: Administrar cuentas, roles y permisos
- Importación Masiva: Importar audiolibros desde YouTube o archivos locales
- Configuración de Email: SMTP configurable para notificaciones
- Códigos de Descuento: Crear y gestionar promociones

---

## Requisitos del Sistema

- Node.js: v18 o superior
- Base de Datos: PostgreSQL (compatible con Neon Database)
- Almacenamiento: Compatible con servicios de almacenamiento de objetos

---

## Instalación

### 1. Clonar el Repositorio
```bash
git clone https://github.com/innovafpiesmmg/audivia.git
cd audivia
```

### 2. Instalar Dependencias
```bash
npm install
```

### 3. Configurar Variables de Entorno
Crea un archivo `.env` con las siguientes variables:

```env
# Base de Datos (obligatorio)
DATABASE_URL=postgresql://usuario:contraseña@host:puerto/basedatos

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

### 4. Ejecutar Migraciones
```bash
npm run db:push
```

### 5. Iniciar la Aplicación
```bash
npm run dev
```

### 6. Configuración Inicial
Al acceder por primera vez a la aplicación, se mostrará un asistente de configuración que te guiará para:
- Verificar la conexión a la base de datos
- Crear la cuenta de administrador

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
├── server/                 # Backend Express
│   ├── routes.ts           # Endpoints API
│   ├── storage.ts          # Capa de almacenamiento
│   ├── paypal-service.ts   # Integración PayPal
│   ├── email.ts            # Servicio de email
│   └── invoice-service.ts  # Generación de facturas
├── shared/                 # Código compartido
│   └── schema.ts           # Esquemas de base de datos
└── migrations/             # Migraciones de BD
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
- PostgreSQL (Neon Database)
- Passport.js para autenticación

### Integraciones
- PayPal SDK para pagos
- Nodemailer para emails
- PDFKit para facturas

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

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | URL de conexión a PostgreSQL | `postgresql://user:pass@localhost:5432/dbname` |
| `SESSION_SECRET` | Secreto para sesiones (aleatorio) | `your-random-secret-key` |
| `PAYPAL_CLIENT_ID` | Client ID de PayPal | `AXxx...` |
| `PAYPAL_CLIENT_SECRET` | Secret de PayPal | `EBxx...` |
| `PAYPAL_MODE` | Modo de PayPal | `sandbox` o `live` |
| `SMTP_HOST` | Servidor SMTP | `smtp.gmail.com` |
| `SMTP_PORT` | Puerto SMTP | `587` |
| `SMTP_USER` | Usuario SMTP | `tu@email.com` |
| `SMTP_PASS` | Contraseña SMTP | `tu-contraseña` |

---

## Comandos de Desarrollo

```bash
# Instalar dependencias
npm install

# Desarrollo con hot-reload
npm run dev

# Construir para producción
npm run build

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
