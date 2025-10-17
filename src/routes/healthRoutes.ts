import express from 'express';
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { db } from '../models/database';
import { config } from '../config';
import Redis from 'ioredis';
import { minioService } from '../services/MinIOService';

const router = express.Router();

// Redis client for health checks
const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

// Health check endpoint
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const healthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      database: 'unknown',
      redis: 'unknown',
      minio: 'unknown',
    },
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };

  // Check database connection
  try {
    await db.raw('SELECT 1');
    healthStatus.services.database = 'healthy';
  } catch (error) {
    healthStatus.services.database = 'unhealthy';
    healthStatus.status = 'degraded';
  }

  // Check Redis connection
  try {
    await redis.ping();
    healthStatus.services.redis = 'healthy';
  } catch (error) {
    healthStatus.services.redis = 'unhealthy';
    healthStatus.status = 'degraded';
  }

  // Check MinIO connection
  try {
    await minioService.fileExists(config.buckets.uploads, '.health-check');
    healthStatus.services.minio = 'healthy';
  } catch (error) {
    healthStatus.services.minio = 'unhealthy';
    healthStatus.status = 'degraded';
  }

  const statusCode = healthStatus.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(healthStatus);
}));

// Readiness check (for Kubernetes)
router.get('/ready', asyncHandler(async (req: Request, res: Response) => {
  try {
    // Check if all critical services are available
    await db.raw('SELECT 1');
    await redis.ping();
    
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

// Liveness check (for Kubernetes)
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export { router as healthRoutes };