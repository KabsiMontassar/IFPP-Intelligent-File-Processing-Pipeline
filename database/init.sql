-- FileFlow Database Schema
-- Version: 1.0.0
-- Description: Complete schema for file processing pipeline

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create enum types
CREATE TYPE file_status AS ENUM ('uploading', 'uploaded', 'processing', 'processed', 'failed');
CREATE TYPE job_status AS ENUM ('waiting', 'active', 'completed', 'failed', 'delayed');
CREATE TYPE job_type AS ENUM ('metadata_extraction', 'thumbnail_generation', 'video_processing', 'document_processing');

-- Files table
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_name VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL UNIQUE,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    hash_sha256 VARCHAR(64) UNIQUE,
    bucket VARCHAR(100) NOT NULL,
    object_key VARCHAR(500) NOT NULL,
    status file_status DEFAULT 'uploading',
    upload_started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    upload_completed_at TIMESTAMP WITH TIME ZONE,
    processing_started_at TIMESTAMP WITH TIME ZONE,
    processing_completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- File metadata table
CREATE TABLE file_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    content_type VARCHAR(100),
    encoding VARCHAR(50),
    language VARCHAR(10),
    title TEXT,
    author VARCHAR(255),
    subject TEXT,
    keywords TEXT[],
    description TEXT,
    created_date TIMESTAMP WITH TIME ZONE,
    modified_date TIMESTAMP WITH TIME ZONE,
    page_count INTEGER,
    word_count INTEGER,
    character_count INTEGER,
    extracted_text TEXT,
    metadata_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Image metadata table
CREATE TABLE image_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    width INTEGER,
    height INTEGER,
    color_depth INTEGER,
    color_space VARCHAR(50),
    compression VARCHAR(50),
    orientation INTEGER,
    camera_make VARCHAR(100),
    camera_model VARCHAR(100),
    lens_model VARCHAR(100),
    focal_length DECIMAL(8,2),
    aperture DECIMAL(4,2),
    shutter_speed VARCHAR(20),
    iso INTEGER,
    flash_used BOOLEAN,
    gps_latitude DECIMAL(10,8),
    gps_longitude DECIMAL(11,8),
    gps_altitude DECIMAL(8,2),
    taken_at TIMESTAMP WITH TIME ZONE,
    exif_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Video metadata table
CREATE TABLE video_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    duration_seconds DECIMAL(10,2),
    width INTEGER,
    height INTEGER,
    frame_rate DECIMAL(6,2),
    bit_rate BIGINT,
    codec VARCHAR(50),
    container_format VARCHAR(50),
    audio_codec VARCHAR(50),
    audio_sample_rate INTEGER,
    audio_channels INTEGER,
    has_video BOOLEAN DEFAULT true,
    has_audio BOOLEAN DEFAULT true,
    metadata_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Processed files table (thumbnails, converted files, etc.)
CREATE TABLE processed_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    process_type VARCHAR(50) NOT NULL, -- 'thumbnail', 'conversion', 'optimized'
    variant VARCHAR(50), -- '250px', '500px', '1000px', 'webp', etc.
    filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100),
    size_bytes BIGINT,
    bucket VARCHAR(100) NOT NULL,
    object_key VARCHAR(500) NOT NULL,
    width INTEGER,
    height INTEGER,
    quality INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(original_file_id, process_type, variant)
);

-- Processing jobs table
CREATE TABLE processing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    job_type job_type NOT NULL,
    status job_status DEFAULT 'waiting',
    priority INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    data JSONB,
    progress INTEGER DEFAULT 0, -- 0-100
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    error_stack TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- File tags table (for categorization)
CREATE TABLE file_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7), -- hex color code
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Many-to-many relationship between files and tags
CREATE TABLE file_tag_associations (
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES file_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (file_id, tag_id)
);

-- File access logs table (for audit)
CREATE TABLE file_access_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- 'upload', 'download', 'view', 'delete'
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_files_status ON files(status);
CREATE INDEX idx_files_mime_type ON files(mime_type);
CREATE INDEX idx_files_created_at ON files(created_at);
CREATE INDEX idx_files_hash ON files(hash_sha256);
CREATE INDEX idx_files_deleted_at ON files(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX idx_file_metadata_file_id ON file_metadata(file_id);
CREATE INDEX idx_file_metadata_title ON file_metadata USING gin(title gin_trgm_ops);
CREATE INDEX idx_file_metadata_author ON file_metadata USING gin(author gin_trgm_ops);
CREATE INDEX idx_file_metadata_keywords ON file_metadata USING gin(keywords);
CREATE INDEX idx_file_metadata_text ON file_metadata USING gin(extracted_text gin_trgm_ops);
CREATE INDEX idx_file_metadata_json ON file_metadata USING gin(metadata_json);

CREATE INDEX idx_image_metadata_file_id ON image_metadata(file_id);
CREATE INDEX idx_image_metadata_dimensions ON image_metadata(width, height);
CREATE INDEX idx_image_metadata_taken_at ON image_metadata(taken_at);
CREATE INDEX idx_image_metadata_gps ON image_metadata(gps_latitude, gps_longitude) WHERE gps_latitude IS NOT NULL;

CREATE INDEX idx_video_metadata_file_id ON video_metadata(file_id);
CREATE INDEX idx_video_metadata_duration ON video_metadata(duration_seconds);
CREATE INDEX idx_video_metadata_dimensions ON video_metadata(width, height);

CREATE INDEX idx_processed_files_original_id ON processed_files(original_file_id);
CREATE INDEX idx_processed_files_type_variant ON processed_files(process_type, variant);

CREATE INDEX idx_processing_jobs_file_id ON processing_jobs(file_id);
CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX idx_processing_jobs_type ON processing_jobs(job_type);
CREATE INDEX idx_processing_jobs_created_at ON processing_jobs(created_at);

CREATE INDEX idx_file_tag_associations_file_id ON file_tag_associations(file_id);
CREATE INDEX idx_file_tag_associations_tag_id ON file_tag_associations(tag_id);

CREATE INDEX idx_file_access_logs_file_id ON file_access_logs(file_id);
CREATE INDEX idx_file_access_logs_action ON file_access_logs(action);
CREATE INDEX idx_file_access_logs_created_at ON file_access_logs(created_at);

-- Create triggers for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON files FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_file_metadata_updated_at BEFORE UPDATE ON file_metadata FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_image_metadata_updated_at BEFORE UPDATE ON image_metadata FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_video_metadata_updated_at BEFORE UPDATE ON video_metadata FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_processing_jobs_updated_at BEFORE UPDATE ON processing_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default tags
INSERT INTO file_tags (name, description, color) VALUES
('Document', 'Text documents and PDFs', '#4285F4'),
('Image', 'Photos and graphics', '#34A853'),
('Video', 'Video files', '#EA4335'),
('Audio', 'Audio files', '#FBBC04'),
('Archive', 'Compressed files', '#9AA0A6'),
('Spreadsheet', 'Excel and CSV files', '#137333'),
('Presentation', 'PowerPoint and presentation files', '#D93025'),
('Code', 'Source code files', '#8E24AA'),
('Data', 'Database and data files', '#E37400');

-- Create view for file search
CREATE VIEW file_search_view AS
SELECT 
    f.id,
    f.original_name,
    f.filename,
    f.mime_type,
    f.size_bytes,
    f.status,
    f.created_at,
    fm.title,
    fm.author,
    fm.subject,
    fm.description,
    fm.keywords,
    fm.extracted_text,
    COALESCE(fm.title, f.original_name) as search_title,
    ARRAY_AGG(ft.name) FILTER (WHERE ft.name IS NOT NULL) as tags
FROM files f
LEFT JOIN file_metadata fm ON f.id = fm.file_id
LEFT JOIN file_tag_associations fta ON f.id = fta.file_id
LEFT JOIN file_tags ft ON fta.tag_id = ft.id
WHERE f.deleted_at IS NULL
GROUP BY f.id, f.original_name, f.filename, f.mime_type, f.size_bytes, f.status, f.created_at,
         fm.title, fm.author, fm.subject, fm.description, fm.keywords, fm.extracted_text;

-- Create search indexes on the underlying tables instead of the view
CREATE INDEX idx_file_metadata_title ON file_metadata USING gin(title gin_trgm_ops);
CREATE INDEX idx_file_metadata_extracted_text ON file_metadata USING gin(extracted_text gin_trgm_ops);
CREATE INDEX idx_files_original_name ON files USING gin(original_name gin_trgm_ops);
CREATE INDEX idx_file_metadata_description ON file_metadata USING gin(description gin_trgm_ops);
CREATE INDEX idx_file_metadata_keywords ON file_metadata USING gin(keywords gin_trgm_ops);