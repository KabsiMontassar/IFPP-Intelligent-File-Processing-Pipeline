import { db } from './database';
import { FileRecord, FileStatus } from '../types';

export class FileModel {
  private static tableName = 'files';

  static async create(fileData: Omit<FileRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<FileRecord> {
    const [file] = await db(this.tableName)
      .insert({
        original_name: fileData.originalName,
        filename: fileData.filename,
        mime_type: fileData.mimeType,
        size_bytes: fileData.sizeBytes,
        hash_sha256: fileData.hashSha256,
        bucket: fileData.bucket,
        object_key: fileData.objectKey,
        status: fileData.status,
        upload_started_at: fileData.uploadStartedAt,
        upload_completed_at: fileData.uploadCompletedAt,
        processing_started_at: fileData.processingStartedAt,
        processing_completed_at: fileData.processingCompletedAt,
        deleted_at: fileData.deletedAt,
      })
      .returning('*');

    return this.mapFromDatabase(file);
  }

  static async findById(id: string): Promise<FileRecord | null> {
    const file = await db(this.tableName)
      .where({ id })
      .whereNull('deleted_at')
      .first();

    return file ? this.mapFromDatabase(file) : null;
  }

  static async findByFilename(filename: string): Promise<FileRecord | null> {
    const file = await db(this.tableName)
      .where({ filename })
      .whereNull('deleted_at')
      .first();

    return file ? this.mapFromDatabase(file) : null;
  }

  static async findByHash(hash: string): Promise<FileRecord | null> {
    const file = await db(this.tableName)
      .where({ hash_sha256: hash })
      .whereNull('deleted_at')
      .first();

    return file ? this.mapFromDatabase(file) : null;
  }

  static async updateStatus(id: string, status: FileStatus, timestamps?: {
    uploadCompletedAt?: Date;
    processingStartedAt?: Date;
    processingCompletedAt?: Date;
  }): Promise<FileRecord | null> {
    const updateData: any = { status };

    if (timestamps?.uploadCompletedAt) {
      updateData.upload_completed_at = timestamps.uploadCompletedAt;
    }
    if (timestamps?.processingStartedAt) {
      updateData.processing_started_at = timestamps.processingStartedAt;
    }
    if (timestamps?.processingCompletedAt) {
      updateData.processing_completed_at = timestamps.processingCompletedAt;
    }

    const [file] = await db(this.tableName)
      .where({ id })
      .update(updateData)
      .returning('*');

    return file ? this.mapFromDatabase(file) : null;
  }

  static async search(params: {
    query?: string;
    mimeType?: string;
    status?: FileStatus;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ files: FileRecord[]; total: number }> {
    let queryBuilder = db(this.tableName).whereNull('deleted_at');

    // Text search
    if (params.query) {
      queryBuilder = queryBuilder.where(function() {
        this.where('original_name', 'ilike', `%${params.query}%`)
          .orWhere('filename', 'ilike', `%${params.query}%`);
      });
    }

    // MIME type filter
    if (params.mimeType) {
      queryBuilder = queryBuilder.where('mime_type', 'like', `${params.mimeType}%`);
    }

    // Status filter
    if (params.status) {
      queryBuilder = queryBuilder.where('status', params.status);
    }

    // Date range filter
    if (params.dateFrom) {
      queryBuilder = queryBuilder.where('created_at', '>=', params.dateFrom);
    }
    if (params.dateTo) {
      queryBuilder = queryBuilder.where('created_at', '<=', params.dateTo);
    }

    // Get total count
    const totalQuery = queryBuilder.clone();
    const [countResult] = await totalQuery.count('* as count');
    const total = Number(countResult?.count) || 0;

    // Apply sorting
    const sortBy = params.sortBy || 'created_at';
    const sortOrder = params.sortOrder || 'desc';
    queryBuilder = queryBuilder.orderBy(sortBy, sortOrder);

    // Apply pagination
    if (params.limit) {
      queryBuilder = queryBuilder.limit(params.limit);
    }
    if (params.offset) {
      queryBuilder = queryBuilder.offset(params.offset);
    }

    const files = await queryBuilder;

    return {
      files: files.map((file: any) => this.mapFromDatabase(file)),
      total,
    };
  }

  static async delete(id: string): Promise<boolean> {
    const result = await db(this.tableName)
      .where({ id })
      .update({ deleted_at: new Date() });

    return result > 0;
  }

  static async findAll(params: {
    limit?: number;
    offset?: number;
    status?: FileStatus;
  } = {}): Promise<FileRecord[]> {
    let queryBuilder = db(this.tableName).whereNull('deleted_at');

    if (params.status) {
      queryBuilder = queryBuilder.where('status', params.status);
    }

    queryBuilder = queryBuilder.orderBy('created_at', 'desc');

    if (params.limit) {
      queryBuilder = queryBuilder.limit(params.limit);
    }
    if (params.offset) {
      queryBuilder = queryBuilder.offset(params.offset);
    }

    const files = await queryBuilder;
    return files.map((file: any) => this.mapFromDatabase(file));
  }

  private static mapFromDatabase(dbRecord: any): FileRecord {
    return {
      id: dbRecord.id,
      originalName: dbRecord.original_name,
      filename: dbRecord.filename,
      mimeType: dbRecord.mime_type,
      sizeBytes: parseInt(dbRecord.size_bytes, 10),
      hashSha256: dbRecord.hash_sha256,
      bucket: dbRecord.bucket,
      objectKey: dbRecord.object_key,
      status: dbRecord.status,
      uploadStartedAt: new Date(dbRecord.upload_started_at),
      uploadCompletedAt: dbRecord.upload_completed_at ? new Date(dbRecord.upload_completed_at) : undefined,
      processingStartedAt: dbRecord.processing_started_at ? new Date(dbRecord.processing_started_at) : undefined,
      processingCompletedAt: dbRecord.processing_completed_at ? new Date(dbRecord.processing_completed_at) : undefined,
      createdAt: new Date(dbRecord.created_at),
      updatedAt: new Date(dbRecord.updated_at),
      deletedAt: dbRecord.deleted_at ? new Date(dbRecord.deleted_at) : undefined,
    };
  }
}