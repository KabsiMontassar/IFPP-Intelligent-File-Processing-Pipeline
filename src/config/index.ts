import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  // Server Configuration
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database Configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'fileflow',
    password: process.env.DB_PASSWORD || 'fileflow_password',
    database: process.env.DB_NAME || 'fileflow_db',
    ssl: process.env.DB_SSL === 'true',
  },

  // Redis Configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
  },

  // MinIO Configuration
  minio: {
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'fileflow_admin',
    secretKey: process.env.MINIO_SECRET_KEY || 'fileflow_admin_password',
  },

  // Bucket Configuration
  buckets: {
    uploads: process.env.UPLOAD_BUCKET || 'fileflow-uploads',
    processed: process.env.PROCESSED_BUCKET || 'fileflow-processed',
    thumbnails: process.env.THUMBNAIL_BUCKET || 'fileflow-thumbnails',
  },

  // File Processing Configuration
  files: {
    maxSize: parseInt(process.env.MAX_FILE_SIZE || '104857600', 10), // 100MB
    allowedTypes: process.env.ALLOWED_FILE_TYPES?.split(',') || [
      'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'json', 'xml',
      'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff',
      'mp4', 'avi', 'mov', 'wmv', 'flv', 'webm',
      'mp3', 'wav', 'flac'
    ],
  },

  // Thumbnail Configuration
  thumbnails: {
    sizes: process.env.THUMBNAIL_SIZES?.split(',').map(Number) || [250, 500, 1000],
    quality: 80,
    format: 'jpeg',
  },

  // Video Configuration
  video: {
    thumbnailTime: process.env.VIDEO_THUMBNAIL_TIME || '00:00:01',
    thumbnailFormat: 'png',
  },

  // Job Queue Configuration
  queue: {
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5', 10),
    attempts: parseInt(process.env.JOB_ATTEMPTS || '3', 10),
    backoffDelay: parseInt(process.env.JOB_BACKOFF_DELAY || '5000', 10),
  },

  // Security Configuration
  security: {
    jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/fileflow.log',
  },

  // External Services
  tika: {
    serverUrl: process.env.TIKA_SERVER_URL || 'http://localhost:9998',
  },

  // Health Check Configuration
  healthCheck: {
    timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000', 10),
  },
} as const;

export default config;