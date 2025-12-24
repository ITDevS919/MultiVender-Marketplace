import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import passport from "passport";
import { pool } from "./db/connection";
import { errorHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/requestLogger";
import { apiRoutes } from "./routes";
import { serveStaticFiles } from "./middleware/staticFiles";
import "./middleware/auth"; // Initialize Passport strategies

const PgSession = connectPgSimple(session);

const app = express();
const httpServer = createServer(app);

// Middleware
// CORS configuration - allow multiple origins for development and production
const allowedOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
  : ["http://localhost:3000"];

// Add common development origins if not in production
if (process.env.NODE_ENV !== "production") {
  if (!allowedOrigins.includes("http://localhost:3000")) {
    allowedOrigins.push("http://localhost:3000");
  }
  if (!allowedOrigins.includes("http://127.0.0.1:3000")) {
    allowedOrigins.push("http://127.0.0.1:3000");
  }
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // In development, be more permissive
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[CORS] Allowing origin in dev mode: ${origin}`);
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    }
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session configuration with PostgreSQL store
app.use(
  session({
    store: new PgSession({
      pool: pool,
      tableName: "session", // Use a different table name if you prefer
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "localito-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    },
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Request logging
app.use(requestLogger);

// API Routes
app.use("/api", apiRoutes);

// Serve static files in production
if (process.env.NODE_ENV === "production") {
  serveStaticFiles(app);
}

// Error handling middleware (must be last)
app.use(errorHandler);

export { app, httpServer };

