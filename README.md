# FileFlow - Intelligent File Processing Pipeline

A scalable, production-ready file processing pipeline built with Node.js, TypeScript, and Docker. FileFlow automatically extracts metadata, generates thumbnails, processes videos, and makes file content searchable through a comprehensive REST API.

## Features

### Core Capabilities

- **RESTful File Upload API** - Multipart/form-data support with validation
- **S3-Compatible Object Storage** - MinIO integration with automated bucket management
- **Asynchronous Background Processing** - Redis Bull Queue for scalable job processing
- **Universal Metadata Extraction** - Apache Tika integration supporting 100+ file formats
- **Automated Image Processing** - Multi-size thumbnail generation with Sharp
- **Video Processing Pipeline** - Thumbnail extraction and metadata parsing with FFmpeg
- **Full-Text Search Engine** - PostgreSQL-based search with GIN indexes
- **Production-Grade Infrastructure** - Complete Docker containerization with health monitoring
- **Type-Safe Implementation** - Full TypeScript coverage with strict type checking

### Technical Stack

- **Backend**: Node.js 18+ with Express.js framework
- **Language**: TypeScript with strict mode enabled
- **Database**: PostgreSQL 15 with full-text search capabilities
- **Cache & Queue**: Redis 7 for caching and job queue management
- **Object Storage**: MinIO for S3-compatible file storage
- **Processing**: Apache Tika, Sharp, FFmpeg for content processing
- **Infrastructure**: Docker with multi-service orchestration

## System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   File Upload   │    │   Processing    │    │    Storage      │
│      API        │────│     Queue       │────│    MinIO        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │      Redis      │    │   Apache Tika   │
│   (Metadata)    │    │   (Job Queue)   │    │  (Text Extract) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Prerequisites

- **Docker 20.10+** and Docker Compose V2
- **Git** for version control
- **Node.js 18.0+** and npm 8.0+ (for local development only)

## Quick Start

### 1. Clone and Setup

```bash
git clone https://github.com/KabsiMontassar/IFPP-Intelligent-File-Processing-Pipeline.git
cd IFPP-Intelligent-File-Processing-Pipeline
cp .env.example .env
```

### 2. Deploy with Docker

```bash
# Start all services
docker compose up -d

# Verify deployment
docker compose ps
```

### 3. Access Services

- **API Server**: http://localhost:3000
- **MinIO Console**: http://localhost:9001 (admin: `fileflow_admin` / `fileflow_admin_password`)
- **Health Check**: http://localhost:3000/health

```bash
# Test API availability
curl http://localhost:3000/health

# Upload a test file
curl -X POST -F "files=@path/to/your/file.pdf" \
  http://localhost:3000/api/v1/files/upload

# Search uploaded files
curl "http://localhost:3000/api/v1/files/search?limit=10"
```

## 🔧 Configuration

### Environment Variables

Key configuration options in `.env`:

```bash
# Server Configuration
NODE_ENV=development
PORT=3000

# Database Configuration (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_USER=fileflow
DB_PASSWORD=fileflow_password
DB_NAME=fileflow_db

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_password

# MinIO Configuration
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=fileflow_admin
MINIO_SECRET_KEY=fileflow_admin_password

# File Processing
MAX_FILE_SIZE=104857600  # 100MB
ALLOWED_FILE_TYPES=pdf,doc,docx,jpg,jpeg,png,mp4,avi
THUMBNAIL_SIZES=250,500,1000
```

### Bucket Configuration

FileFlow creates three MinIO buckets automatically:
- `fileflow-uploads`: Original uploaded files
- `fileflow-processed`: Processed/converted files
- `fileflow-thumbnails`: Generated thumbnails

## API Documentation

### Base URL
```
http://localhost:3000
```

### File Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/files/upload` | Upload files with multipart/form-data |
| `GET` | `/api/v1/files/{id}` | Retrieve file information and metadata |
| `GET` | `/api/v1/files/{id}/download` | Get file download URL |
| `GET` | `/api/v1/files/{id}/stream` | Stream file content directly |
| `DELETE` | `/api/v1/files/{id}` | Delete file (soft delete) |
| `GET` | `/api/v1/files/search` | Search files with query parameters |

### System Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | API information and version |
| `GET` | `/health` | System health status |

## 📤 Upload Examples

### Single File Upload

```bash
curl -X POST \
  http://localhost:3000/api/v1/files/upload \
  -H 'Content-Type: multipart/form-data' \
  -F 'files=@/path/to/your/document.pdf'
```

### Multiple Files Upload

```bash
curl -X POST \
  http://localhost:3000/api/v1/files/upload \
  -H 'Content-Type: multipart/form-data' \
  -F 'files=@/path/to/document.pdf' \
  -F 'files=@/path/to/image.jpg'
```

### Upload with JavaScript/TypeScript

```typescript
const formData = new FormData();
formData.append('files', fileInput.files[0]);

const response = await fetch('/api/v1/files/upload', {
  method: 'POST',
  body: formData,
});

const result = await response.json();
console.log('Upload result:', result);
```

## 🔍 Search Examples

### Text Search

```bash
# Search by filename or content
curl "http://localhost:3000/api/v1/files/search?q=contract"

# Search by MIME type
curl "http://localhost:3000/api/v1/files/search?mimeType=image"

# Search with filters
curl "http://localhost:3000/api/v1/files/search?q=report&dateFrom=2023-01-01&limit=10"
```

## 🏃‍♂️ Development

### Local Development Setup

```bash
# Install dependencies
npm install

# Start development server (API)
npm run dev

# Start worker process (separate terminal)
npm run worker

# Run tests
npm test

# Lint code
npm run lint
```

### Project Structure

```
src/
├── config/           # Configuration management
├── controllers/      # Request handlers (if using controller pattern)
├── middleware/       # Express middleware
├── models/           # Database models and queries
├── routes/           # API route definitions
├── services/         # Business logic and external services
│   ├── MinIOService.ts
│   ├── QueueService.ts
│   ├── MetadataProcessor.ts
│   ├── ImageProcessor.ts
│   ├── VideoProcessor.ts
│   └── DocumentProcessor.ts
├── types/            # TypeScript type definitions
├── utils/            # Utility functions and helpers
├── workers/          # Background job processors
└── index.ts          # Application entry point
```

## 🔄 Background Processing

FileFlow uses Redis Bull Queue for background processing:

### Job Types

1. **Metadata Extraction**: Extracts metadata from all file types
2. **Thumbnail Generation**: Creates multiple sizes for images
3. **Video Processing**: Extracts video thumbnails and metadata
4. **Document Processing**: Text extraction from documents

### Queue Monitoring

```bash
# Check queue status
curl http://localhost:3000/api/v1/admin/queues/status

# View failed jobs
curl http://localhost:3000/api/v1/admin/queues/failed
```

## 📊 Database Schema

### Key Tables

- **files**: Main file records with upload metadata
- **file_metadata**: Extracted metadata from files
- **image_metadata**: EXIF data and image-specific metadata
- **video_metadata**: Video format, duration, codecs
- **processed_files**: Generated thumbnails and conversions
- **processing_jobs**: Background job tracking

### Relationships

```sql
files (1) ────── (1) file_metadata
files (1) ────── (0..1) image_metadata
files (1) ────── (0..1) video_metadata
files (1) ────── (0..*) processed_files
files (1) ────── (0..*) processing_jobs
```

## 🐳 Docker Deployment

### Production Deployment

```bash
# Build production images
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

# Start production stack
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Service Dependencies

Services start in order:
1. PostgreSQL, Redis, MinIO
2. MinIO bucket initialization
3. FileFlow API server
4. FileFlow worker processes

## 📈 Monitoring & Logging

### Health Checks

All services include health checks:
- API server: HTTP endpoint monitoring
- Database: Connection testing
- Redis: Ping/pong verification
- MinIO: Object storage accessibility

### Logging

Structured logging with Winston:
- Console output (development)
- File rotation (production)
- Error tracking and job monitoring

### Metrics

Built-in metrics available:
- File upload rates
- Processing queue length
- Job completion times
- Error rates by service

## 🔒 Security

### Features

- **Rate Limiting**: Configurable request limits
- **CORS Protection**: Cross-origin request handling
- **Helmet**: Security headers
- **File Validation**: Type and size restrictions
- **Input Sanitization**: Request validation

### Production Recommendations

1. **Environment Variables**: Use secrets management
2. **HTTPS**: Enable SSL/TLS termination
3. **Authentication**: Add JWT or OAuth integration
4. **Network**: Use private networks for services
5. **Monitoring**: Enable security event logging

## 🔧 Troubleshooting

### Common Issues

#### 1. Service Connection Errors

```bash
# Check service status
docker-compose logs

# Verify network connectivity
docker-compose exec fileflow-api ping postgres
```

#### 2. File Upload Failures

```bash
# Check MinIO bucket permissions
docker-compose exec minio mc ls minio/fileflow-uploads

# Verify disk space
df -h
```

#### 3. Processing Queue Issues

```bash
# Check Redis connectivity
docker-compose exec redis redis-cli ping

# Monitor job queue
curl http://localhost:3000/health
```

### Debug Mode

```bash
# Enable debug logging
export LOG_LEVEL=debug

# Start with verbose output
docker-compose up
```

## 🔒 Security & Known Issues

### Security Considerations

- **Multer**: Updated to v2.x to address security vulnerabilities found in 1.x versions
- **File Validation**: All uploaded files are validated for type and size
- **Sandboxed Processing**: File processing happens in isolated containers
- **Environment Variables**: All sensitive data is stored in environment variables

### Known Dependencies

- **fluent-ffmpeg**: Currently using v2.1.3 which shows a deprecation warning. This is a widely used package with no direct replacement yet. Monitor for updates to newer alternatives like `node-ffmpeg` or `ffmpeg-static`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/your-username/fileflow-pipeline/issues)
- **Documentation**: [Wiki](https://github.com/your-username/fileflow-pipeline/wiki)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/fileflow-pipeline/discussions)

## Development Roadmap

### Phase 1: Security & Authentication
- JWT-based user authentication and authorization
- Role-based access control (RBAC)
- API key management for programmatic access

### Phase 2: Enhanced Features  
- File versioning and revision history
- Webhook notifications for processing events
- Batch file operations and bulk processing

### Phase 3: Scalability & Performance
- Elasticsearch integration for advanced search
- CDN integration for global file distribution
- Horizontal scaling with Kubernetes support

### Phase 4: Enterprise Features
- Audit logging and compliance reporting
- Advanced analytics and usage metrics
- Enterprise SSO integration

## Contributing

We welcome contributions from the community. Please read our contributing guidelines and code of conduct before submitting pull requests.

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Support

For technical support and questions:
- GitHub Issues for bug reports and feature requests
- Documentation for comprehensive guides
- Security issues should be reported privately through GitHub Security advisories