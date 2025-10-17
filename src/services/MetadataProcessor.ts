import { exec } from 'child_process';
import { promisify } from 'util';
import { MetadataExtractor } from '../types';
import { config } from '../config';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

export class MetadataProcessor implements MetadataExtractor {
  private tikaServerUrl: string;

  constructor() {
    this.tikaServerUrl = config.tika.serverUrl;
  }

  async extractMetadata(filePath: string): Promise<Record<string, any>> {
    try {
      // Use Apache Tika via HTTP request
      const { stdout } = await execAsync(
        `curl -T "${filePath}" "${this.tikaServerUrl}/meta" -H "Accept: application/json"`
      );
      
      const metadata = JSON.parse(stdout);
      
      logger.info('Metadata extracted successfully', {
        filePath,
        metadataKeys: Object.keys(metadata),
      });
      
      return metadata;
    } catch (error) {
      // Fallback to basic file metadata if Tika is not available
      logger.warn('Tika server not available, using fallback metadata extraction', {
        filePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      return this.extractBasicMetadata(filePath);
    }
  }

  async extractText(filePath: string): Promise<string> {
    try {
      // Use Apache Tika for text extraction
      const { stdout } = await execAsync(
        `curl -T "${filePath}" "${this.tikaServerUrl}/tika" -H "Accept: text/plain"`
      );
      
      logger.info('Text extracted successfully', {
        filePath,
        textLength: stdout.length,
      });
      
      return stdout.trim();
    } catch (error) {
      logger.error('Text extraction failed', error, { filePath });
      return '';
    }
  }

  private async extractBasicMetadata(filePath: string): Promise<Record<string, any>> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const stats = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      
      return {
        'File-Size': stats.size,
        'File-Modified': stats.mtime.toISOString(),
        'File-Created': stats.birthtime.toISOString(),
        'File-Extension': ext,
        'Content-Type': this.getMimeTypeFromExtension(ext),
      };
    } catch (error) {
      logger.error('Basic metadata extraction failed', error, { filePath });
      return {};
    }
  }

  private getMimeTypeFromExtension(ext: string): string {
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.tiff': 'image/tiff',
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.wmv': 'video/x-ms-wmv',
      '.flv': 'video/x-flv',
      '.webm': 'video/webm',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.flac': 'audio/flac',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  async isHealthy(): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`curl -f "${this.tikaServerUrl}/version"`);
      return stdout.includes('Apache Tika');
    } catch (error) {
      return false;
    }
  }
}