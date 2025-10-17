import ffmpeg from 'fluent-ffmpeg';
import { VideoProcessor as IVideoProcessor } from '../types';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

export class VideoProcessor implements IVideoProcessor {
  async extractThumbnail(inputPath: string, timeOffset = '00:00:01'): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const tempDir = path.dirname(inputPath);
      const tempOutput = path.join(tempDir, `thumbnail-${Date.now()}.png`);
      
      ffmpeg(inputPath)
        .screenshots({
          timestamps: [timeOffset],
          filename: path.basename(tempOutput),
          folder: tempDir,
          size: '1280x720',
        })
        .on('end', () => {
          try {
            const buffer = fs.readFileSync(tempOutput);
            fs.unlinkSync(tempOutput); // Clean up temp file
            
            logger.info('Video thumbnail extracted successfully', {
              inputPath,
              timeOffset,
              thumbnailSize: buffer.length,
            });
            
            resolve(buffer);
          } catch (error) {
            logger.error('Failed to read video thumbnail', error, { inputPath, timeOffset });
            reject(new Error(`Failed to read video thumbnail: ${error}`));
          }
        })
        .on('error', (error) => {
          logger.error('Video thumbnail extraction failed', error, { inputPath, timeOffset });
          reject(new Error(`Video thumbnail extraction failed: ${error.message}`));
        });
    });
  }

  async extractMetadata(inputPath: string): Promise<Record<string, any>> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (error, metadata) => {
        if (error) {
          logger.error('Video metadata extraction failed', error, { inputPath });
          reject(new Error(`Video metadata extraction failed: ${error.message}`));
          return;
        }

        try {
          const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
          const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
          
          const processedMetadata = {
            // General information
            format: metadata.format?.format_name,
            formatLongName: metadata.format?.format_long_name,
            duration: metadata.format?.duration ? parseFloat(String(metadata.format.duration)) : null,
            size: metadata.format?.size ? parseInt(String(metadata.format.size), 10) : null,
            bitRate: metadata.format?.bit_rate ? parseInt(String(metadata.format.bit_rate), 10) : null,
            
            // Video stream information
            video: videoStream ? {
              codec: videoStream.codec_name,
              codecLongName: videoStream.codec_long_name,
              width: videoStream.width,
              height: videoStream.height,
              pixelFormat: videoStream.pix_fmt,
              frameRate: this.parseFrameRate(videoStream.r_frame_rate || videoStream.avg_frame_rate),
              bitRate: videoStream.bit_rate ? parseInt(videoStream.bit_rate, 10) : null,
              profile: videoStream.profile,
              level: videoStream.level,
            } : null,
            
            // Audio stream information
            audio: audioStream ? {
              codec: audioStream.codec_name,
              codecLongName: audioStream.codec_long_name,
              sampleRate: audioStream.sample_rate ? parseInt(String(audioStream.sample_rate), 10) : null,
              channels: audioStream.channels,
              channelLayout: audioStream.channel_layout,
              bitRate: audioStream.bit_rate ? parseInt(String(audioStream.bit_rate), 10) : null,
            } : null,
            
            // Original metadata
            rawMetadata: metadata,
          };
          
          logger.info('Video metadata extracted successfully', {
            inputPath,
            duration: processedMetadata.duration,
            hasVideo: !!processedMetadata.video,
            hasAudio: !!processedMetadata.audio,
            videoCodec: processedMetadata.video?.codec,
            audioCodec: processedMetadata.audio?.codec,
          });
          
          resolve(processedMetadata);
        } catch (processingError) {
          logger.error('Video metadata processing failed', processingError, { inputPath });
          reject(new Error(`Video metadata processing failed: ${processingError}`));
        }
      });
    });
  }

  async convertVideo(
    inputPath: string,
    format: string,
    options: Record<string, any> = {}
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const tempDir = path.dirname(inputPath);
      const tempOutput = path.join(tempDir, `converted-${Date.now()}.${format}`);
      
      let command = ffmpeg(inputPath);
      
      // Apply common options
      if (options.videoBitrate) {
        command = command.videoBitrate(options.videoBitrate);
      }
      if (options.videoCodec) {
        command = command.videoCodec(options.videoCodec);
      }
      if (options.audioCodec) {
        command = command.audioCodec(options.audioCodec);
      }
      if (options.audioBitrate) {
        command = command.audioBitrate(options.audioBitrate);
      }
      if (options.size) {
        command = command.size(options.size);
      }
      if (options.fps) {
        command = command.fps(options.fps);
      }
      
      command
        .format(format)
        .output(tempOutput)
        .on('end', () => {
          try {
            const buffer = fs.readFileSync(tempOutput);
            fs.unlinkSync(tempOutput); // Clean up temp file
            
            logger.info('Video conversion completed successfully', {
              inputPath,
              format,
              options,
              outputSize: buffer.length,
            });
            
            resolve(buffer);
          } catch (error) {
            logger.error('Failed to read converted video', error, { inputPath, format });
            reject(new Error(`Failed to read converted video: ${error}`));
          }
        })
        .on('error', (error) => {
          logger.error('Video conversion failed', error, { inputPath, format, options });
          reject(new Error(`Video conversion failed: ${error.message}`));
        })
        .run();
    });
  }

  async getVideoInfo(inputPath: string): Promise<{
    duration: number;
    width: number;
    height: number;
    frameRate: number;
    bitRate: number;
    format: string;
    hasAudio: boolean;
    hasVideo: boolean;
  }> {
    try {
      const metadata = await this.extractMetadata(inputPath);
      
      return {
        duration: metadata.duration || 0,
        width: metadata.video?.width || 0,
        height: metadata.video?.height || 0,
        frameRate: metadata.video?.frameRate || 0,
        bitRate: metadata.bitRate || 0,
        format: metadata.format || 'unknown',
        hasAudio: !!metadata.audio,
        hasVideo: !!metadata.video,
      };
    } catch (error) {
      logger.error('Failed to get video info', error, { inputPath });
      throw new Error(`Failed to get video info: ${error}`);
    }
  }

  async extractAudio(inputPath: string, format = 'mp3'): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const tempDir = path.dirname(inputPath);
      const tempOutput = path.join(tempDir, `audio-${Date.now()}.${format}`);
      
      ffmpeg(inputPath)
        .noVideo()
        .audioCodec(format === 'mp3' ? 'libmp3lame' : 'aac')
        .format(format)
        .output(tempOutput)
        .on('end', () => {
          try {
            const buffer = fs.readFileSync(tempOutput);
            fs.unlinkSync(tempOutput); // Clean up temp file
            
            logger.info('Audio extraction completed successfully', {
              inputPath,
              format,
              outputSize: buffer.length,
            });
            
            resolve(buffer);
          } catch (error) {
            logger.error('Failed to read extracted audio', error, { inputPath, format });
            reject(new Error(`Failed to read extracted audio: ${error}`));
          }
        })
        .on('error', (error) => {
          logger.error('Audio extraction failed', error, { inputPath, format });
          reject(new Error(`Audio extraction failed: ${error.message}`));
        })
        .run();
    });
  }

  private parseFrameRate(frameRateString?: string): number {
    if (!frameRateString) return 0;
    
    const parts = frameRateString.split('/');
    if (parts.length === 2 && parts[0] && parts[1]) {
      const numerator = parseFloat(parts[0]);
      const denominator = parseFloat(parts[1]);
      if (denominator !== 0) {
        return numerator / denominator;
      }
    }
    
    return parseFloat(frameRateString) || 0;
  }
}