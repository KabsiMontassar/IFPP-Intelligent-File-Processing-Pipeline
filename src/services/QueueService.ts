import Queue from 'bull';
import Redis from 'ioredis';
import { config } from '../config';
import {
  MetadataExtractionJobData,
  ThumbnailGenerationJobData,
  VideoProcessingJobData,
  DocumentProcessingJobData,
} from '../types';
import { logger } from '../utils/logger';

// Redis connection for Bull
const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: 3,
});

// Job queue definitions
export const metadataQueue = new Queue('metadata extraction', {
  redis: {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
  },
  defaultJobOptions: {
    attempts: config.queue.attempts,
    backoff: {
      type: 'exponential',
      delay: config.queue.backoffDelay,
    },
    removeOnComplete: 10,
    removeOnFail: 50,
  },
});

export const thumbnailQueue = new Queue('thumbnail generation', {
  redis: {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
  },
  defaultJobOptions: {
    attempts: config.queue.attempts,
    backoff: {
      type: 'exponential',
      delay: config.queue.backoffDelay,
    },
    removeOnComplete: 10,
    removeOnFail: 50,
  },
});

export const videoQueue = new Queue('video processing', {
  redis: {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
  },
  defaultJobOptions: {
    attempts: config.queue.attempts,
    backoff: {
      type: 'exponential',
      delay: config.queue.backoffDelay,
    },
    removeOnComplete: 10,
    removeOnFail: 50,
  },
});

export const documentQueue = new Queue('document processing', {
  redis: {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
  },
  defaultJobOptions: {
    attempts: config.queue.attempts,
    backoff: {
      type: 'exponential',
      delay: config.queue.backoffDelay,
    },
    removeOnComplete: 10,
    removeOnFail: 50,
  },
});

export class QueueService {
  async addMetadataExtractionJob(data: MetadataExtractionJobData, priority = 0): Promise<void> {
    try {
      await metadataQueue.add('extract-metadata', data, {
        priority,
        delay: 0,
      });
      
      logger.info('Metadata extraction job added to queue', {
        fileId: data.fileId,
        filePath: data.filePath,
        priority,
      });
    } catch (error) {
      logger.error('Failed to add metadata extraction job to queue', error, {
        fileId: data.fileId,
        filePath: data.filePath,
      });
      throw error;
    }
  }

  async addThumbnailGenerationJob(data: ThumbnailGenerationJobData, priority = 0): Promise<void> {
    try {
      await thumbnailQueue.add('generate-thumbnails', data, {
        priority,
        delay: 0,
      });
      
      logger.info('Thumbnail generation job added to queue', {
        fileId: data.fileId,
        filePath: data.filePath,
        sizes: data.sizes,
        priority,
      });
    } catch (error) {
      logger.error('Failed to add thumbnail generation job to queue', error, {
        fileId: data.fileId,
        filePath: data.filePath,
      });
      throw error;
    }
  }

  async addVideoProcessingJob(data: VideoProcessingJobData, priority = 0): Promise<void> {
    try {
      await videoQueue.add('process-video', data, {
        priority,
        delay: 0,
      });
      
      logger.info('Video processing job added to queue', {
        fileId: data.fileId,
        filePath: data.filePath,
        thumbnailTime: data.thumbnailTime,
        priority,
      });
    } catch (error) {
      logger.error('Failed to add video processing job to queue', error, {
        fileId: data.fileId,
        filePath: data.filePath,
      });
      throw error;
    }
  }

  async addDocumentProcessingJob(data: DocumentProcessingJobData, priority = 0): Promise<void> {
    try {
      await documentQueue.add('process-document', data, {
        priority,
        delay: 0,
      });
      
      logger.info('Document processing job added to queue', {
        fileId: data.fileId,
        filePath: data.filePath,
        extractText: data.extractText,
        extractMetadata: data.extractMetadata,
        priority,
      });
    } catch (error) {
      logger.error('Failed to add document processing job to queue', error, {
        fileId: data.fileId,
        filePath: data.filePath,
      });
      throw error;
    }
  }

  async getQueueStatus(): Promise<{
    metadata: any;
    thumbnail: any;
    video: any;
    document: any;
  }> {
    try {
      const [metadataStats, thumbnailStats, videoStats, documentStats] = await Promise.all([
        metadataQueue.getJobCounts(),
        thumbnailQueue.getJobCounts(),
        videoQueue.getJobCounts(),
        documentQueue.getJobCounts(),
      ]);

      return {
        metadata: metadataStats,
        thumbnail: thumbnailStats,
        video: videoStats,
        document: documentStats,
      };
    } catch (error) {
      logger.error('Failed to get queue status', error);
      throw error;
    }
  }

  async clearAllQueues(): Promise<void> {
    try {
      await Promise.all([
        metadataQueue.empty(),
        thumbnailQueue.empty(),
        videoQueue.empty(),
        documentQueue.empty(),
      ]);
      
      logger.info('All queues cleared');
    } catch (error) {
      logger.error('Failed to clear queues', error);
      throw error;
    }
  }

  async gracefulShutdown(): Promise<void> {
    try {
      logger.info('Shutting down queue service gracefully');
      
      await Promise.all([
        metadataQueue.close(),
        thumbnailQueue.close(),
        videoQueue.close(),
        documentQueue.close(),
      ]);
      
      await redis.disconnect();
      logger.info('Queue service shutdown complete');
    } catch (error) {
      logger.error('Error during queue service shutdown', error);
    }
  }
}

// Create singleton instance
export const queueService = new QueueService();

// Queue event listeners
metadataQueue.on('completed', (job) => {
  logger.info('Metadata extraction job completed', {
    jobId: job.id,
    fileId: job.data.fileId,
    duration: Date.now() - job.timestamp,
  });
});

metadataQueue.on('failed', (job, err) => {
  logger.error('Metadata extraction job failed', err, {
    jobId: job.id,
    fileId: job.data.fileId,
    attempts: job.attemptsMade,
  });
});

thumbnailQueue.on('completed', (job) => {
  logger.info('Thumbnail generation job completed', {
    jobId: job.id,
    fileId: job.data.fileId,
    duration: Date.now() - job.timestamp,
  });
});

thumbnailQueue.on('failed', (job, err) => {
  logger.error('Thumbnail generation job failed', err, {
    jobId: job.id,
    fileId: job.data.fileId,
    attempts: job.attemptsMade,
  });
});

videoQueue.on('completed', (job) => {
  logger.info('Video processing job completed', {
    jobId: job.id,
    fileId: job.data.fileId,
    duration: Date.now() - job.timestamp,
  });
});

videoQueue.on('failed', (job, err) => {
  logger.error('Video processing job failed', err, {
    jobId: job.id,
    fileId: job.data.fileId,
    attempts: job.attemptsMade,
  });
});

documentQueue.on('completed', (job) => {
  logger.info('Document processing job completed', {
    jobId: job.id,
    fileId: job.data.fileId,
    duration: Date.now() - job.timestamp,
  });
});

documentQueue.on('failed', (job, err) => {
  logger.error('Document processing job failed', err, {
    jobId: job.id,
    fileId: job.data.fileId,
    attempts: job.attemptsMade,
  });
});