import sharp from 'sharp';
import * as exifr from 'exifr';
import { ImageProcessor as IImageProcessor } from '../types';
import { logger } from '../utils/logger';

export class ImageProcessor implements IImageProcessor {
  async generateThumbnails(
    inputPath: string,
    sizes: number[]
  ): Promise<{ size: number; buffer: Buffer; filename: string }[]> {
    try {
      const thumbnails = [];
      
      for (const size of sizes) {
        const buffer = await sharp(inputPath)
          .resize(size, size, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({
            quality: 80,
            progressive: true,
          })
          .toBuffer();
        
        thumbnails.push({
          size,
          buffer,
          filename: `thumbnail-${size}px.jpg`,
        });
        
        logger.debug('Thumbnail generated', {
          inputPath,
          size,
          outputSize: buffer.length,
        });
      }
      
      logger.info('All thumbnails generated successfully', {
        inputPath,
        sizes,
        count: thumbnails.length,
      });
      
      return thumbnails;
    } catch (error) {
      logger.error('Thumbnail generation failed', error, {
        inputPath,
        sizes,
      });
      throw new Error(`Failed to generate thumbnails: ${error}`);
    }
  }

  async extractExifData(inputPath: string): Promise<Record<string, any>> {
    try {
      const exifData = await exifr.parse(inputPath, {
        icc: false,
        iptc: false,
        xmp: false,
        jfif: false,
        ihdr: false,
        pick: [
          'Make',
          'Model',
          'LensModel',
          'FocalLength',
          'FNumber',
          'ExposureTime',
          'ISO',
          'Flash',
          'DateTimeOriginal',
          'GPS',
          'ImageWidth',
          'ImageHeight',
          'Orientation',
          'ColorSpace',
          'WhiteBalance',
          'ExposureMode',
          'SceneCaptureType',
        ],
      });
      
      // Process GPS coordinates if available
      if (exifData?.GPS) {
        const gps = exifData.GPS;
        if (gps.latitude && gps.longitude) {
          exifData.GPS = {
            latitude: gps.latitude,
            longitude: gps.longitude,
            altitude: gps.altitude || null,
          };
        }
      }
      
      logger.info('EXIF data extracted successfully', {
        inputPath,
        hasGPS: !!exifData?.GPS,
        fields: Object.keys(exifData || {}),
      });
      
      return exifData || {};
    } catch (error) {
      logger.warn('EXIF data extraction failed', {
        inputPath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {};
    }
  }

  async optimizeImage(inputPath: string, quality = 80): Promise<Buffer> {
    try {
      const image = sharp(inputPath);
      const metadata = await image.metadata();
      
      let optimizedBuffer: Buffer;
      
      // Choose optimization strategy based on image format
      switch (metadata.format) {
        case 'jpeg':
          optimizedBuffer = await image
            .jpeg({
              quality,
              progressive: true,
              mozjpeg: true,
            })
            .toBuffer();
          break;
          
        case 'png':
          optimizedBuffer = await image
            .png({
              compressionLevel: 9,
              progressive: true,
            })
            .toBuffer();
          break;
          
        case 'webp':
          optimizedBuffer = await image
            .webp({
              quality,
              effort: 6,
            })
            .toBuffer();
          break;
          
        default:
          // Convert to JPEG for other formats
          optimizedBuffer = await image
            .jpeg({
              quality,
              progressive: true,
            })
            .toBuffer();
      }
      
      const originalSize = (await import('fs')).statSync(inputPath).size;
      const optimizedSize = optimizedBuffer.length;
      const compressionRatio = ((originalSize - optimizedSize) / originalSize * 100).toFixed(1);
      
      logger.info('Image optimized successfully', {
        inputPath,
        originalSize,
        optimizedSize,
        compressionRatio: `${compressionRatio}%`,
        format: metadata.format,
      });
      
      return optimizedBuffer;
    } catch (error) {
      logger.error('Image optimization failed', error, { inputPath, quality });
      throw new Error(`Failed to optimize image: ${error}`);
    }
  }

  async getImageInfo(inputPath: string): Promise<{
    width: number;
    height: number;
    format: string;
    colorSpace: string;
    channels: number;
    density: number;
    hasAlpha: boolean;
  }> {
    try {
      const image = sharp(inputPath);
      const metadata = await image.metadata();
      
      return {
        width: metadata.width || 0,
        height: metadata.height || 0,
        format: metadata.format || 'unknown',
        colorSpace: metadata.space || 'unknown',
        channels: metadata.channels || 0,
        density: metadata.density || 0,
        hasAlpha: metadata.hasAlpha || false,
      };
    } catch (error) {
      logger.error('Failed to get image info', error, { inputPath });
      throw new Error(`Failed to get image info: ${error}`);
    }
  }

  async convertFormat(
    inputPath: string,
    outputFormat: 'jpeg' | 'png' | 'webp' | 'avif',
    quality = 80
  ): Promise<Buffer> {
    try {
      const image = sharp(inputPath);
      
      let convertedBuffer: Buffer;
      
      switch (outputFormat) {
        case 'jpeg':
          convertedBuffer = await image
            .jpeg({ quality, progressive: true })
            .toBuffer();
          break;
          
        case 'png':
          convertedBuffer = await image
            .png({ compressionLevel: 9 })
            .toBuffer();
          break;
          
        case 'webp':
          convertedBuffer = await image
            .webp({ quality, effort: 6 })
            .toBuffer();
          break;
          
        case 'avif':
          convertedBuffer = await image
            .avif({ quality, effort: 9 })
            .toBuffer();
          break;
          
        default:
          throw new Error(`Unsupported output format: ${outputFormat}`);
      }
      
      logger.info('Image format converted successfully', {
        inputPath,
        outputFormat,
        outputSize: convertedBuffer.length,
      });
      
      return convertedBuffer;
    } catch (error) {
      logger.error('Image format conversion failed', error, {
        inputPath,
        outputFormat,
        quality,
      });
      throw new Error(`Failed to convert image format: ${error}`);
    }
  }
}