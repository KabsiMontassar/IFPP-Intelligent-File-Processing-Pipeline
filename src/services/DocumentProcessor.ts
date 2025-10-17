import { MetadataExtractor } from '../types';
import { logger } from '../utils/logger';

export class DocumentProcessor implements MetadataExtractor {
  async extractMetadata(filePath: string): Promise<Record<string, any>> {
    try {
      // Use Apache Tika for document metadata extraction
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const { stdout } = await execAsync(
        `curl -T "${filePath}" "http://localhost:9998/meta" -H "Accept: application/json"`
      );
      
      const metadata = JSON.parse(stdout);
      
      // Process and clean metadata
      const processedMetadata = this.processDocumentMetadata(metadata);
      
      logger.info('Document metadata extracted successfully', {
        filePath,
        metadataKeys: Object.keys(processedMetadata),
        title: processedMetadata.title,
        author: processedMetadata.author,
        pageCount: processedMetadata.pageCount,
      });
      
      return processedMetadata;
    } catch (error) {
      logger.warn('Document metadata extraction failed, using fallback', {
        filePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      return this.extractFallbackMetadata(filePath);
    }
  }

  async extractText(filePath: string): Promise<string> {
    try {
      // Use Apache Tika for text extraction
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const { stdout } = await execAsync(
        `curl -T "${filePath}" "http://localhost:9998/tika" -H "Accept: text/plain"`
      );
      
      // Clean and process extracted text
      const cleanedText = this.cleanExtractedText(stdout);
      
      logger.info('Document text extracted successfully', {
        filePath,
        originalLength: stdout.length,
        cleanedLength: cleanedText.length,
        wordCount: this.countWords(cleanedText),
      });
      
      return cleanedText;
    } catch (error) {
      logger.error('Document text extraction failed', error, { filePath });
      return '';
    }
  }

  async processDocument(filePath: string): Promise<{
    metadata: Record<string, any>;
    text: string;
    wordCount: number;
    characterCount: number;
    pageCount?: number;
  }> {
    try {
      const [metadata, text] = await Promise.all([
        this.extractMetadata(filePath),
        this.extractText(filePath),
      ]);
      
      const wordCount = this.countWords(text);
      const characterCount = text.length;
      const pageCount = metadata.pageCount || this.estimatePageCount(text);
      
      logger.info('Document processing completed', {
        filePath,
        wordCount,
        characterCount,
        pageCount,
        hasMetadata: Object.keys(metadata).length > 0,
        hasText: text.length > 0,
      });
      
      return {
        metadata,
        text,
        wordCount,
        characterCount,
        pageCount,
      };
    } catch (error) {
      logger.error('Document processing failed', error, { filePath });
      throw new Error(`Document processing failed: ${error}`);
    }
  }

  private processDocumentMetadata(rawMetadata: Record<string, any>): Record<string, any> {
    const processed: Record<string, any> = {};
    
    // Standard metadata fields
    const fieldMappings: Record<string, string[]> = {
      title: ['title', 'dc:title', 'Title'],
      author: ['author', 'dc:creator', 'Author', 'meta:author'],
      subject: ['subject', 'dc:subject', 'Subject'],
      description: ['description', 'dc:description', 'Description'],
      keywords: ['keywords', 'dc:keywords', 'Keywords', 'meta:keyword'],
      created: ['created', 'dc:created', 'Creation-Date', 'meta:creation-date'],
      modified: ['modified', 'dc:modified', 'Last-Modified', 'meta:save-date'],
      language: ['language', 'dc:language', 'Language'],
      format: ['format', 'dc:format', 'Content-Type'],
      pageCount: ['xmpTPg:NPages', 'meta:page-count', 'Page-Count'],
      wordCount: ['meta:word-count', 'Word-Count'],
      characterCount: ['meta:character-count', 'Character-Count'],
    };
    
    for (const [targetField, sourceFields] of Object.entries(fieldMappings)) {
      for (const sourceField of sourceFields) {
        if (rawMetadata[sourceField] !== undefined && rawMetadata[sourceField] !== null) {
          processed[targetField] = rawMetadata[sourceField];
          break;
        }
      }
    }
    
    // Convert numeric fields
    ['pageCount', 'wordCount', 'characterCount'].forEach(field => {
      if (processed[field] && typeof processed[field] === 'string') {
        const numValue = parseInt(processed[field], 10);
        if (!isNaN(numValue)) {
          processed[field] = numValue;
        }
      }
    });
    
    // Process dates
    ['created', 'modified'].forEach(field => {
      if (processed[field] && typeof processed[field] === 'string') {
        try {
          processed[field] = new Date(processed[field]).toISOString();
        } catch (error) {
          // Keep original string if date parsing fails
        }
      }
    });
    
    // Process keywords array
    if (processed.keywords && typeof processed.keywords === 'string') {
      processed.keywords = processed.keywords
        .split(/[,;]/)
        .map((keyword: string) => keyword.trim())
        .filter((keyword: string) => keyword.length > 0);
    }
    
    // Store raw metadata for reference
    processed.rawMetadata = rawMetadata;
    
    return processed;
  }

  private async extractFallbackMetadata(filePath: string): Promise<Record<string, any>> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const stats = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const baseName = path.basename(filePath, ext);
      
      return {
        filename: path.basename(filePath),
        title: baseName,
        fileSize: stats.size,
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString(),
        extension: ext,
        mimeType: this.getMimeTypeFromExtension(ext),
      };
    } catch (error) {
      logger.error('Fallback metadata extraction failed', error, { filePath });
      return {};
    }
  }

  private cleanExtractedText(text: string): string {
    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove leading/trailing whitespace
      .trim()
      // Remove common OCR artifacts
      .replace(/[^\w\s.,;:!?'"()[\]{}-]/g, '')
      // Normalize line breaks
      .replace(/\n\s*\n/g, '\n\n');
  }

  private countWords(text: string): number {
    return text
      .split(/\s+/)
      .filter(word => word.length > 0 && /[a-zA-Z0-9]/.test(word))
      .length;
  }

  private estimatePageCount(text: string): number {
    // Rough estimation: 250 words per page
    const wordCount = this.countWords(text);
    return Math.max(1, Math.ceil(wordCount / 250));
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
      '.rtf': 'application/rtf',
      '.odt': 'application/vnd.oasis.opendocument.text',
      '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
      '.odp': 'application/vnd.oasis.opendocument.presentation',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }
}