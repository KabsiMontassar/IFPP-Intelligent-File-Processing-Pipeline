import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { fileRoutes } from './routes/fileRoutes';
import { healthRoutes } from './routes/healthRoutes';
import { minioService } from './services/MinIOService';
import { testDatabaseConnection } from './models/database';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

class Application {
  public app: express.Application;

  constructor() {
    this.app = express();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors());

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.security.rateLimitWindow,
      max: config.security.rateLimitMax,
      message: 'Too many requests from this IP, please try again later.',
    });
    this.app.use(limiter);

    // Body parsing and compression
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging
    this.app.use(morgan('combined', {
      stream: {
        write: (message: string) => logger.info(message.trim()),
      },
    }));

    // Request ID middleware
    this.app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      req.id = Math.random().toString(36).substring(2, 15);
      res.setHeader('X-Request-ID', req.id);
      next();
    });
  }

  private initializeRoutes(): void {
    // API routes
    this.app.use('/api/v1/files', fileRoutes);
    this.app.use('/health', healthRoutes);

    // Root endpoint
    this.app.get('/', (req: express.Request, res: express.Response) => {
      res.json({
        name: 'FileFlow API',
        version: '1.0.0',
        description: 'Intelligent File Processing Pipeline',
        status: 'online',
        timestamp: new Date().toISOString(),
      });
    });

    // 404 handler
    this.app.use('*', (req: express.Request, res: express.Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`,
        statusCode: 404,
      });
    });
  }

  private initializeErrorHandling(): void {
    this.app.use(errorHandler);
  }

  public async start(): Promise<void> {
    try {
      // Test database connection
      const dbConnected = await testDatabaseConnection();
      if (!dbConnected) {
        throw new Error('Database connection failed');
      }
      logger.info('Database connected successfully');

      // Initialize MinIO buckets
      await minioService.initializeBuckets();
      logger.info('MinIO buckets initialized');

      // Start server
      const server = this.app.listen(config.port, () => {
        logger.info(`FileFlow API server running on port ${config.port}`);
        logger.info(`Environment: ${config.nodeEnv}`);
      });

      // Graceful shutdown
      process.on('SIGTERM', async () => {
        logger.info('SIGTERM received, shutting down gracefully');
        server.close(() => {
          logger.info('Process terminated');
          process.exit(0);
        });
      });

      process.on('SIGINT', async () => {
        logger.info('SIGINT received, shutting down gracefully');
        server.close(() => {
          logger.info('Process terminated');
          process.exit(0);
        });
      });

    } catch (error) {
      logger.error('Failed to start application:', error);
      process.exit(1);
    }
  }
}

// Start the application
const app = new Application();
app.start().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});

export { Application };