import { Client, CopyConditions } from 'minio';
import { config } from '../config';
import { StorageService } from '../types';

export class MinIOService implements StorageService {
  private client: Client;

  constructor() {
    this.client = new Client({
      endPoint: config.minio.endPoint,
      port: config.minio.port,
      useSSL: config.minio.useSSL,
      accessKey: config.minio.accessKey,
      secretKey: config.minio.secretKey,
    });
  }

  async initializeBuckets(): Promise<void> {
    const buckets = [
      config.buckets.uploads,
      config.buckets.processed,
      config.buckets.thumbnails,
    ];

    for (const bucket of buckets) {
      const exists = await this.client.bucketExists(bucket);
      if (!exists) {
        await this.client.makeBucket(bucket);
        console.log(`Created bucket: ${bucket}`);
      }
    }
  }

  async uploadFile(
    bucket: string,
    objectKey: string,
    data: Buffer | NodeJS.ReadableStream,
    metadata?: Record<string, string>
  ): Promise<void> {
    try {
      await this.client.putObject(bucket, objectKey, data as any, metadata);
    } catch (error) {
      throw new Error(`Failed to upload file to MinIO: ${error}`);
    }
  }

  async downloadFile(bucket: string, objectKey: string): Promise<Buffer> {
    try {
      const stream = await this.client.getObject(bucket, objectKey);
      const chunks: Buffer[] = [];
      
      return new Promise((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });
    } catch (error) {
      throw new Error(`Failed to download file from MinIO: ${error}`);
    }
  }

  async getFileStream(bucket: string, objectKey: string): Promise<NodeJS.ReadableStream> {
    try {
      return await this.client.getObject(bucket, objectKey);
    } catch (error) {
      throw new Error(`Failed to get file stream from MinIO: ${error}`);
    }
  }

  async deleteFile(bucket: string, objectKey: string): Promise<void> {
    try {
      await this.client.removeObject(bucket, objectKey);
    } catch (error) {
      throw new Error(`Failed to delete file from MinIO: ${error}`);
    }
  }

  async getFileInfo(bucket: string, objectKey: string): Promise<{
    size: number;
    lastModified: Date;
    etag: string;
  }> {
    try {
      const stat = await this.client.statObject(bucket, objectKey);
      return {
        size: stat.size,
        lastModified: stat.lastModified,
        etag: stat.etag,
      };
    } catch (error) {
      throw new Error(`Failed to get file info from MinIO: ${error}`);
    }
  }

  async generatePresignedUrl(bucket: string, objectKey: string, expiry: number = 3600): Promise<string> {
    try {
      return await this.client.presignedGetObject(bucket, objectKey, expiry);
    } catch (error) {
      throw new Error(`Failed to generate presigned URL: ${error}`);
    }
  }

  async listFiles(bucket: string, prefix?: string): Promise<string[]> {
    try {
      const objectsList: string[] = [];
      const stream = this.client.listObjectsV2(bucket, prefix, true);
      
      return new Promise((resolve, reject) => {
        stream.on('data', (obj) => {
          if (obj.name) {
            objectsList.push(obj.name);
          }
        });
        stream.on('end', () => resolve(objectsList));
        stream.on('error', reject);
      });
    } catch (error) {
      throw new Error(`Failed to list files from MinIO: ${error}`);
    }
  }

  async copyFile(
    sourceBucket: string,
    sourceObjectKey: string,
    destBucket: string,
    destObjectKey: string
  ): Promise<void> {
    try {
      const copyConditions = new CopyConditions();
      await this.client.copyObject(
        destBucket,
        destObjectKey,
        `/${sourceBucket}/${sourceObjectKey}`,
        copyConditions
      );
    } catch (error) {
      throw new Error(`Failed to copy file in MinIO: ${error}`);
    }
  }

  async fileExists(bucket: string, objectKey: string): Promise<boolean> {
    try {
      await this.client.statObject(bucket, objectKey);
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Create singleton instance
export const minioService = new MinIOService();