import {
  metadataQueue,
  thumbnailQueue,
  videoQueue,
  documentQueue,
} from '../services/QueueService';
import { MetadataProcessor } from '../services/MetadataProcessor';
import { ImageProcessor } from '../services/ImageProcessor';
import { VideoProcessor } from '../services/VideoProcessor';
import { DocumentProcessor } from '../services/DocumentProcessor';
import { FileModel } from '../models/FileModel';
import { minioService } from '../services/MinIOService';
import { config } from '../config';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Create temp directory for processing
const tempDir = path.join(os.tmpdir(), 'fileflow-processing');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Initialize processors
const metadataProcessor = new MetadataProcessor();
const imageProcessor = new ImageProcessor();
const videoProcessor = new VideoProcessor();
const documentProcessor = new DocumentProcessor();

// Metadata extraction worker
metadataQueue.process('extract-metadata', config.queue.concurrency, async (job) => {
  const { fileId, filePath, mimeType } = job.data;
  
  logger.info('Processing metadata extraction job', { fileId, filePath, mimeType });
  
  try {
    // Update file status
    await FileModel.updateStatus(fileId, 'processing', {
      processingStartedAt: new Date(),
    });

    // Download file to temp location
    const tempFilePath = path.join(tempDir, `${fileId}-${Date.now()}`);
    const fileBuffer = await minioService.downloadFile(config.buckets.uploads, filePath);
    fs.writeFileSync(tempFilePath, fileBuffer);

    // Extract metadata
    const metadata = await metadataProcessor.extractMetadata(tempFilePath);
    
    // Extract text content if it's a document
    let extractedText = '';
    if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) {
      extractedText = await metadataProcessor.extractText(tempFilePath);
    }

    // Save metadata to database
    // TODO: Implement metadata model and save operation

    // Clean up temp file
    fs.unlinkSync(tempFilePath);

    // Update file status
    await FileModel.updateStatus(fileId, 'processed', {
      processingCompletedAt: new Date(),
    });

    logger.info('Metadata extraction completed', {
      fileId,
      metadataKeys: Object.keys(metadata),
      textLength: extractedText.length,
    });

    return { metadata, extractedText };
  } catch (error) {
    logger.error('Metadata extraction failed', error, { fileId, filePath });
    
    // Update file status to failed
    await FileModel.updateStatus(fileId, 'failed');
    
    throw error;
  }
});

// Thumbnail generation worker
thumbnailQueue.process('generate-thumbnails', config.queue.concurrency, async (job) => {
  const { fileId, filePath, sizes, format, quality } = job.data;
  
  logger.info('Processing thumbnail generation job', { fileId, filePath, sizes });
  
  try {
    // Download image to temp location
    const tempFilePath = path.join(tempDir, `${fileId}-${Date.now()}`);
    const fileBuffer = await minioService.downloadFile(config.buckets.uploads, filePath);
    fs.writeFileSync(tempFilePath, fileBuffer);

    // Generate thumbnails
    const thumbnails = await imageProcessor.generateThumbnails(tempFilePath, sizes);
    
    // Extract EXIF data
    const exifData = await imageProcessor.extractExifData(tempFilePath);

    // Upload thumbnails to MinIO
    const uploadedThumbnails = [];
    for (const thumbnail of thumbnails) {
      const thumbnailKey = `thumbnails/${fileId}/${thumbnail.filename}`;
      await minioService.uploadFile(
        config.buckets.thumbnails,
        thumbnailKey,
        thumbnail.buffer,
        {
          'Content-Type': `image/${format}`,
          'Thumbnail-Size': thumbnail.size.toString(),
          'Original-File-ID': fileId,
        }
      );
      
      uploadedThumbnails.push({
        size: thumbnail.size,
        filename: thumbnail.filename,
        objectKey: thumbnailKey,
      });
    }

    // Save processed files and image metadata to database
    // TODO: Implement processed files and image metadata models

    // Clean up temp file
    fs.unlinkSync(tempFilePath);

    logger.info('Thumbnail generation completed', {
      fileId,
      thumbnailCount: thumbnails.length,
      sizes,
    });

    return { thumbnails: uploadedThumbnails, exifData };
  } catch (error) {
    logger.error('Thumbnail generation failed', error, { fileId, filePath });
    throw error;
  }
});

// Video processing worker
videoQueue.process('process-video', config.queue.concurrency, async (job) => {
  const { fileId, filePath, thumbnailTime } = job.data;
  
  logger.info('Processing video job', { fileId, filePath, thumbnailTime });
  
  try {
    // Download video to temp location
    const tempFilePath = path.join(tempDir, `${fileId}-${Date.now()}`);
    const fileBuffer = await minioService.downloadFile(config.buckets.uploads, filePath);
    fs.writeFileSync(tempFilePath, fileBuffer);

    // Extract video metadata
    const metadata = await videoProcessor.extractMetadata(tempFilePath);
    
    // Generate video thumbnail
    const thumbnailBuffer = await videoProcessor.extractThumbnail(tempFilePath, thumbnailTime);
    
    // Upload thumbnail to MinIO
    const thumbnailKey = `thumbnails/${fileId}/video-thumbnail.png`;
    await minioService.uploadFile(
      config.buckets.thumbnails,
      thumbnailKey,
      thumbnailBuffer,
      {
        'Content-Type': 'image/png',
        'Thumbnail-Type': 'video',
        'Original-File-ID': fileId,
      }
    );

    // Save video metadata and processed file to database
    // TODO: Implement video metadata and processed files models

    // Clean up temp file
    fs.unlinkSync(tempFilePath);

    logger.info('Video processing completed', {
      fileId,
      metadata: Object.keys(metadata),
      thumbnailGenerated: true,
    });

    return { metadata, thumbnailKey };
  } catch (error) {
    logger.error('Video processing failed', error, { fileId, filePath });
    throw error;
  }
});

// Document processing worker
documentQueue.process('process-document', config.queue.concurrency, async (job) => {
  const { fileId, filePath, extractText, extractMetadata } = job.data;
  
  logger.info('Processing document job', { fileId, filePath, extractText, extractMetadata });
  
  try {
    // Download document to temp location
    const tempFilePath = path.join(tempDir, `${fileId}-${Date.now()}`);
    const fileBuffer = await minioService.downloadFile(config.buckets.uploads, filePath);
    fs.writeFileSync(tempFilePath, fileBuffer);

    let metadata = {};
    let extractedText = '';

    if (extractMetadata) {
      metadata = await documentProcessor.extractMetadata(tempFilePath);
    }

    if (extractText) {
      extractedText = await documentProcessor.extractText(tempFilePath);
    }

    // Save document metadata to database
    // TODO: Implement document metadata model

    // Clean up temp file
    fs.unlinkSync(tempFilePath);

    logger.info('Document processing completed', {
      fileId,
      metadataExtracted: extractMetadata,
      textExtracted: extractText,
      textLength: extractedText.length,
    });

    return { metadata, extractedText };
  } catch (error) {
    logger.error('Document processing failed', error, { fileId, filePath });
    throw error;
  }
});

// Worker startup
async function startWorkers(): Promise<void> {
  logger.info('Starting FileFlow workers', {
    concurrency: config.queue.concurrency,
    tempDir,
  });

  // Graceful shutdown handlers
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down workers gracefully');
    
    await Promise.all([
      metadataQueue.close(),
      thumbnailQueue.close(),
      videoQueue.close(),
      documentQueue.close(),
    ]);
    
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down workers gracefully');
    
    await Promise.all([
      metadataQueue.close(),
      thumbnailQueue.close(),
      videoQueue.close(),
      documentQueue.close(),
    ]);
    
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    process.exit(0);
  });

  logger.info('Workers started successfully');
}

// Start workers if this file is run directly
if (require.main === module) {
  startWorkers().catch((error) => {
    logger.error('Failed to start workers', error);
    process.exit(1);
  });
}

export { startWorkers };