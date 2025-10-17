import express from 'express';
import multer from 'multer';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import path from 'path';
import { asyncHandler } from '../middleware/errorHandler';
import { FileModel } from '../models/FileModel';
import { minioService } from '../services/MinIOService';
import { queueService } from '../services/QueueService';
import { config } from '../config';
import { ValidationError, NotFoundError } from '../types';
import { logger } from '../utils/logger';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.files.maxSize,
    files: 10, // Maximum 10 files per request
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().substring(1);
    if (config.files.allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new ValidationError(`File type .${ext} is not allowed`));
    }
  },
});

// POST /upload - Upload files
router.post('/upload', upload.array('files'), asyncHandler(async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];
  
  if (!files || files.length === 0) {
    throw new ValidationError('No files provided');
  }

  const uploadedFiles = [];

  for (const file of files) {
    // Generate unique filename
    const fileId = uuidv4();
    const fileExtension = path.extname(file.originalname);
    const filename = `${fileId}${fileExtension}`;
    
    // Calculate file hash
    const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');
    
    // Check for duplicate files
    const existingFile = await FileModel.findByHash(hash);
    if (existingFile) {
      uploadedFiles.push({
        id: existingFile.id,
        originalName: file.originalname,
        filename: existingFile.filename,
        size: existingFile.sizeBytes,
        mimeType: existingFile.mimeType,
        isDuplicate: true,
      });
      continue;
    }

    // Upload to MinIO
    const objectKey = `uploads/${filename}`;
    await minioService.uploadFile(
      config.buckets.uploads,
      objectKey,
      file.buffer,
      {
        'Content-Type': file.mimetype,
        'Original-Name': file.originalname,
        'File-Hash': hash,
      }
    );

    // Save file record to database
    const fileRecord = await FileModel.create({
      originalName: file.originalname,
      filename,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      hashSha256: hash,
      bucket: config.buckets.uploads,
      objectKey,
      status: 'uploaded',
      uploadStartedAt: new Date(),
      uploadCompletedAt: new Date(),
    });

    // Queue processing jobs
    await queueService.addMetadataExtractionJob({
      fileId: fileRecord.id,
      filePath: objectKey,
      mimeType: file.mimetype,
    });

    if (file.mimetype.startsWith('image/')) {
      await queueService.addThumbnailGenerationJob({
        fileId: fileRecord.id,
        filePath: objectKey,
        sizes: config.thumbnails.sizes,
        format: config.thumbnails.format,
        quality: config.thumbnails.quality,
      });
    }

    if (file.mimetype.startsWith('video/')) {
      await queueService.addVideoProcessingJob({
        fileId: fileRecord.id,
        filePath: objectKey,
        thumbnailTime: config.video.thumbnailTime,
      });
    }

    uploadedFiles.push({
      id: fileRecord.id,
      originalName: file.originalname,
      filename,
      size: file.size,
      mimeType: file.mimetype,
      isDuplicate: false,
    });

    logger.info('File uploaded successfully', {
      fileId: fileRecord.id,
      filename: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    });
  }

  res.status(201).json({
    message: 'Files uploaded successfully',
    files: uploadedFiles,
  });
}));

// GET /files/:id - Get file information
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  if (!id) {
    throw new ValidationError('File ID is required');
  }
  
  const file = await FileModel.findById(id);
  if (!file) {
    throw new NotFoundError('File not found');
  }

  // TODO: Get metadata, processed files, and jobs
  const response = {
    file,
    metadata: null, // TODO: Implement metadata retrieval
    processedFiles: [], // TODO: Implement processed files retrieval
    processingJobs: [], // TODO: Implement jobs retrieval
  };

  res.json(response);
}));

// GET /files/:id/download - Download file
router.get('/:id/download', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  if (!id) {
    throw new ValidationError('File ID is required');
  }
  
  const file = await FileModel.findById(id);
  if (!file) {
    throw new NotFoundError('File not found');
  }

  // Generate presigned URL for direct download from MinIO
  const downloadUrl = await minioService.generatePresignedUrl(
    file.bucket,
    file.objectKey,
    3600 // 1 hour expiry
  );

  res.json({
    downloadUrl,
    filename: file.originalName,
    mimeType: file.mimeType,
    size: file.sizeBytes,
  });
}));

// GET /files/:id/stream - Stream file content
router.get('/:id/stream', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  if (!id) {
    throw new ValidationError('File ID is required');
  }
  
  const file = await FileModel.findById(id);
  if (!file) {
    throw new NotFoundError('File not found');
  }

  // Set response headers
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Length', file.sizeBytes);
  res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);

  // Stream file from MinIO
  const stream = await minioService.getFileStream(file.bucket, file.objectKey);
  stream.pipe(res);
}));

// GET /search - Search files
router.get('/search', asyncHandler(async (req: Request, res: Response) => {
  const {
    q,
    mimeType,
    status,
    dateFrom,
    dateTo,
    limit = 20,
    offset = 0,
    sortBy = 'created_at',
    sortOrder = 'desc',
  } = req.query;

  const searchParams = {
    query: q as string,
    mimeType: mimeType as string,
    status: status as any,
    dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
    dateTo: dateTo ? new Date(dateTo as string) : undefined,
    limit: parseInt(limit as string, 10),
    offset: parseInt(offset as string, 10),
    sortBy: sortBy as string,
    sortOrder: sortOrder as 'asc' | 'desc',
  };

  const result = await FileModel.search(searchParams);

  res.json({
    files: result.files,
    total: result.total,
    limit: searchParams.limit,
    offset: searchParams.offset,
  });
}));

// DELETE /files/:id - Delete file
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  if (!id) {
    throw new ValidationError('File ID is required');
  }
  
  const file = await FileModel.findById(id);
  if (!file) {
    throw new NotFoundError('File not found');
  }

  // Delete from MinIO
  await minioService.deleteFile(file.bucket, file.objectKey);

  // Soft delete from database
  await FileModel.delete(id);

  logger.info('File deleted successfully', {
    fileId: id,
    filename: file.originalName,
  });

  res.json({
    message: 'File deleted successfully',
    fileId: id,
  });
}));

export { router as fileRoutes };