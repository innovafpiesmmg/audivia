import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { pool as pgPool } from "./db";
import { initializeAdmin } from "./init-admin";
import { storage } from "./storage";

const app = express();

// Validate required environment variables
if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required. Please set it in your .env file.");
}

// Trust proxy for secure cookies behind reverse proxies/load balancers
app.set("trust proxy", 1);

// Configure session store
const PgSession = connectPg(session);
app.use(
  session({
    store: new PgSession({
      pool: pgPool,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  })
);

// Extend Express session type
declare module "express-session" {
  interface SessionData {
    userId: string;
    pendingDiscount?: {
      discountCodeId: string;
      discountCode: string;
      discountAmountCents: number;
      originalTotalCents: number;
      finalTotalCents: number;
    };
  }
}

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize admin user on startup
  await initializeAdmin();

  // Job de limpieza: eliminar compras pendientes después de 24 horas
  const cleanupPendingPurchases = async () => {
    try {
      const result = await storage.deleteOldPendingPurchases(24);
      if (result.deletedPurchases > 0 || result.deletedCartItems > 0) {
        log(`Limpieza automática: ${result.deletedPurchases} compras pendientes y ${result.deletedCartItems} items de carrito eliminados`);
      }
    } catch (error) {
      log(`Error en limpieza automática: ${error}`);
    }
  };

  // Ejecutar limpieza cada hora
  setInterval(cleanupPendingPurchases, 60 * 60 * 1000);
  // Ejecutar limpieza al inicio después de 10 segundos
  setTimeout(cleanupPendingPurchases, 10000);
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
