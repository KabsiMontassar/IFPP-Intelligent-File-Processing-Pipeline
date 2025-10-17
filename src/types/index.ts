// File-related types
export interface FileRecord {
  id: string;
  originalName: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  hashSha256?: string;
  bucket: string;
  objectKey: string;
  status: FileStatus;
  uploadStartedAt: Date;
  uploadCompletedAt?: Date;
  processingStartedAt?: Date;
  processingCompletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export type FileStatus = 'uploading' | 'uploaded' | 'processing' | 'processed' | 'failed';

export interface FileMetadata {
  id: string;
  fileId: string;
  contentType?: string;
  encoding?: string;
  language?: string;
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  description?: string;
  createdDate?: Date;
  modifiedDate?: Date;
  pageCount?: number;
  wordCount?: number;
  characterCount?: number;
  extractedText?: string;
  metadataJson?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ImageMetadata {
  id: string;
  fileId: string;
  width?: number;
  height?: number;
  colorDepth?: number;
  colorSpace?: string;
  compression?: string;
  orientation?: number;
  cameraMake?: string;
  cameraModel?: string;
  lensModel?: string;
  focalLength?: number;
  aperture?: number;
  shutterSpeed?: string;
  iso?: number;
  flashUsed?: boolean;
  gpsLatitude?: number;
  gpsLongitude?: number;
  gpsAltitude?: number;
  takenAt?: Date;
  exifJson?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface VideoMetadata {
  id: string;
  fileId: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  frameRate?: number;
  bitRate?: number;
  codec?: string;
  containerFormat?: string;
  audioCodec?: string;
  audioSampleRate?: number;
  audioChannels?: number;
  hasVideo?: boolean;
  hasAudio?: boolean;
  metadataJson?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProcessedFile {
  id: string;
  originalFileId: string;
  processType: string;
  variant?: string;
  filename: string;
  mimeType?: string;
  sizeBytes?: number;
  bucket: string;
  objectKey: string;
  width?: number;
  height?: number;
  quality?: number;
  createdAt: Date;
}

// Job-related types
export type JobStatus = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
export type JobType = 'metadata_extraction' | 'thumbnail_generation' | 'video_processing' | 'document_processing';

export interface ProcessingJob {
  id: string;
  fileId: string;
  jobType: JobType;
  status: JobStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  data?: Record<string, any>;
  progress: number;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  errorMessage?: string;
  errorStack?: string;
  createdAt: Date;
  updatedAt: Date;
}

// API Request/Response types
export interface UploadRequest {
  files: Express.Multer.File[];
  tags?: string[];
}

export interface UploadResponse {
  files: {
    id: string;
    originalName: string;
    filename: string;
    size: number;
    mimeType: string;
    uploadUrl?: string;
  }[];
  message: string;
}

export interface FileInfoResponse {
  file: FileRecord;
  metadata?: FileMetadata;
  imageMetadata?: ImageMetadata;
  videoMetadata?: VideoMetadata;
  processedFiles: ProcessedFile[];
  processingJobs: ProcessingJob[];
  tags: FileTag[];
}

export interface SearchRequest {
  q?: string;
  mimeType?: string;
  status?: FileStatus;
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'size' | 'created' | 'modified';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResponse {
  files: FileRecord[];
  total: number;
  limit: number;
  offset: number;
}

// Tag-related types
export interface FileTag {
  id: string;
  name: string;
  description?: string;
  color?: string;
  createdAt: Date;
}

export interface FileTagAssociation {
  fileId: string;
  tagId: string;
  createdAt: Date;
}

// Service types
export interface StorageService {
  uploadFile(bucket: string, objectKey: string, data: Buffer | NodeJS.ReadableStream, metadata?: Record<string, string>): Promise<void>;
  downloadFile(bucket: string, objectKey: string): Promise<Buffer>;
  getFileStream(bucket: string, objectKey: string): Promise<NodeJS.ReadableStream>;
  deleteFile(bucket: string, objectKey: string): Promise<void>;
  getFileInfo(bucket: string, objectKey: string): Promise<{ size: number; lastModified: Date; etag: string }>;
  generatePresignedUrl(bucket: string, objectKey: string, expiry?: number): Promise<string>;
}

export interface MetadataExtractor {
  extractMetadata(filePath: string): Promise<Record<string, any>>;
  extractText(filePath: string): Promise<string>;
}

export interface ImageProcessor {
  generateThumbnails(inputPath: string, sizes: number[]): Promise<{ size: number; buffer: Buffer; filename: string }[]>;
  extractExifData(inputPath: string): Promise<Record<string, any>>;
  optimizeImage(inputPath: string, quality?: number): Promise<Buffer>;
}

export interface VideoProcessor {
  extractThumbnail(inputPath: string, timeOffset?: string): Promise<Buffer>;
  extractMetadata(inputPath: string): Promise<Record<string, any>>;
  convertVideo(inputPath: string, format: string, options?: Record<string, any>): Promise<Buffer>;
}

// Error types
export class FileFlowError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'FileFlowError';
  }
}

export class ValidationError extends FileFlowError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends FileFlowError {
  constructor(message: string) {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class StorageError extends FileFlowError {
  constructor(message: string, details?: any) {
    super(message, 500, 'STORAGE_ERROR', details);
    this.name = 'StorageError';
  }
}

export class ProcessingError extends FileFlowError {
  constructor(message: string, details?: any) {
    super(message, 500, 'PROCESSING_ERROR', details);
    this.name = 'ProcessingError';
  }
}

// Queue job data types
export interface MetadataExtractionJobData {
  fileId: string;
  filePath: string;
  mimeType: string;
}

export interface ThumbnailGenerationJobData {
  fileId: string;
  filePath: string;
  sizes: number[];
  format: string;
  quality: number;
}

export interface VideoProcessingJobData {
  fileId: string;
  filePath: string;
  thumbnailTime: string;
}

export interface DocumentProcessingJobData {
  fileId: string;
  filePath: string;
  extractText: boolean;
  extractMetadata: boolean;
}

// Configuration types
export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean;
}

export interface RedisConfig {
  host: string;
  port: number;
  password: string;
}

export interface MinIOConfig {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  database: DatabaseConfig;
  redis: RedisConfig;
  minio: MinIOConfig;
  buckets: {
    uploads: string;
    processed: string;
    thumbnails: string;
  };
  files: {
    maxSize: number;
    allowedTypes: string[];
  };
  thumbnails: {
    sizes: number[];
    quality: number;
    format: string;
  };
  video: {
    thumbnailTime: string;
    thumbnailFormat: string;
  };
  queue: {
    concurrency: number;
    attempts: number;
    backoffDelay: number;
  };
  security: {
    jwtSecret: string;
    rateLimitWindow: number;
    rateLimitMax: number;
  };
  logging: {
    level: string;
    file: string;
  };
  tika: {
    serverUrl: string;
  };
  healthCheck: {
    timeout: number;
  };
}

// Express middleware types
export interface MulterFileExtended extends Express.Multer.File {
  hash?: string;
}

export interface AuthenticatedRequest extends Express.Request {
  id?: string;
  user?: {
    id: string;
    email: string;
    role: string;
  };
}