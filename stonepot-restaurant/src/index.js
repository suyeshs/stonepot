import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { config } from './config/index.js';
import restaurantRoutes, { setupWebSocketServer } from './routes/restaurantRoutes.js';
import menuUploadRoutes from './routes/menuUploadRoutes.js';

const app = express();
const server = createServer(app);

// Middleware
app.use(express.json());

// CORS configuration with wildcard subdomain support
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin matches allowed origins or wildcard patterns
    const allowedOrigins = config.cors.allowedOrigins || [];
    const isAllowed = allowedOrigins.some(allowed => {
      // Exact match
      if (allowed === origin) return true;

      // Wildcard subdomain match (e.g., https://*.thestonepot.pro)
      if (allowed.includes('*')) {
        const pattern = allowed.replace(/\./g, '\\.').replace(/\*/g, '[^.]+');
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(origin);
      }

      return false;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn('[CORS] Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};

app.use(cors(corsOptions));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'stonepot-restaurant',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/restaurant', restaurantRoutes);
app.use('/api/admin/menu', menuUploadRoutes);
app.use('/api/tenants', menuUploadRoutes);

// Setup WebSocket server for audio streaming
setupWebSocketServer(server);

const PORT = config.server.port || 3001;
const HOST = config.server.host || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`🍽️  Stonepot Restaurant server running on ${HOST}:${PORT}`);
  console.log(`📍 Environment: ${config.server.env}`);
  console.log(`🎤 WebSocket server ready for audio streaming`);
  console.log(`🎨 Display API: ${config.cloudflare.workerUrl}`);
});

export default app;
