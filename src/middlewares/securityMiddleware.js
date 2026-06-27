import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';

// Global rate limiting (disabled)
export const globalLimiter = (req, res, next) => next();

// Authentication rate limiting (disabled)
export const authLimiter = (req, res, next) => next();

// Bot API rate limiting (disabled)
export const botApiLimiter = (req, res, next) => next();

// Helmet Configuration
export const setupHelmet = () => {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', '*'],
        connectSrc: ["'self'", 'ws:', 'wss:', '*'],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" }
  });
};

export const setupCors = () => {
  const allowedOrigins = [
    'http://localhost:5173', // Vite standard dev port
    'http://127.0.0.1:5173',
    'http://localhost:3000',
  ];

  if (process.env.CLIENT_URL) {
    allowedOrigins.push(process.env.CLIENT_URL.replace(/\/$/, ''));
  }
  if (process.env.ALLOWED_ORIGINS) {
    const origins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim().replace(/\/$/, ''));
    allowedOrigins.push(...origins);
  }
  
  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl bot requests)
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-bot-token']
  });
};

// Clean XSS payloads
export const xssClean = (req, res, next) => {
  const sanitize = (data) => {
    if (typeof data === 'string') {
      return data
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    } else if (typeof data === 'object' && data !== null) {
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          data[key] = sanitize(data[key]);
        }
      }
    }
    return data;
  };

  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  req.params = sanitize(req.params);
  next();
};
