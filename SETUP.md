# FileFlow Setup Instructions

## Prerequisites

Before starting, ensure you have the following installed:

- **Node.js 18+** - [Download here](https://nodejs.org/)
- **Docker Desktop** - [Download here](https://www.docker.com/products/docker-desktop/)
- **Git** - [Download here](https://git-scm.com/)

## Quick Setup Guide

### 1. Clone and Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd fileflow-pipeline

# Copy environment file
cp .env.example .env

# Install dependencies
npm install
```

### 2. Start Services with Docker

```bash
# Start all services in the background
docker-compose up -d

# Wait for services to initialize (about 30-60 seconds)
docker-compose logs -f

# Check all services are healthy
docker-compose ps
```

### 3. Verify Installation

```bash
# Test API health
curl http://localhost:3000/health

# Test file upload
curl -X POST \
  http://localhost:3000/api/v1/files/upload \
  -F 'files=@/path/to/test/file.pdf'
```

## Manual Service Setup (Development)

If you prefer to run services individually:

### Database Setup (PostgreSQL)

```bash
# Start PostgreSQL
docker run -d \
  --name fileflow-postgres \
  -e POSTGRES_USER=fileflow \
  -e POSTGRES_PASSWORD=fileflow_password \
  -e POSTGRES_DB=fileflow_db \
  -p 5432:5432 \
  postgres:15-alpine

# Run database migrations
npm run migrate
```

### Redis Setup

```bash
# Start Redis
docker run -d \
  --name fileflow-redis \
  -p 6379:6379 \
  redis:7-alpine redis-server --requirepass redis_password
```

### MinIO Setup

```bash
# Start MinIO
docker run -d \
  --name fileflow-minio \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER=fileflow_admin \
  -e MINIO_ROOT_PASSWORD=fileflow_admin_password \
  minio/minio server /data --console-address ":9001"

# Create buckets (run after MinIO starts)
docker exec fileflow-minio \
  mc alias set local http://localhost:9000 fileflow_admin fileflow_admin_password

docker exec fileflow-minio mc mb local/fileflow-uploads
docker exec fileflow-minio mc mb local/fileflow-processed
docker exec fileflow-minio mc mb local/fileflow-thumbnails
```

### Apache Tika Setup (Optional)

```bash
# Download and start Tika server
wget https://archive.apache.org/dist/tika/2.8.0/tika-server-standard-2.8.0.jar
java -jar tika-server-standard-2.8.0.jar --host=0.0.0.0 --port=9998
```

## Development Workflow

### Start Development Servers

```bash
# Terminal 1: Start API server
npm run dev

# Terminal 2: Start worker processes
npm run worker

# Terminal 3: Monitor logs
docker-compose logs -f
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- --grep "FileModel"
```

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

## Production Deployment

### Environment Configuration

Create production environment file:

```bash
cp .env.example .env.production
```

Update critical settings:
```bash
NODE_ENV=production
JWT_SECRET=your-super-secure-random-secret-key
DB_PASSWORD=secure-database-password
REDIS_PASSWORD=secure-redis-password
MINIO_SECRET_KEY=secure-minio-secret-key
```

### Docker Production Build

```bash
# Build production images
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

# Start production services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Monitor startup
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f
```

### SSL/TLS Setup

For production, set up reverse proxy with SSL:

```nginx
# nginx.conf
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Service URLs

When all services are running:

- **API Server**: http://localhost:3000
- **MinIO Console**: http://localhost:9001 (admin/password)
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
- **Apache Tika**: http://localhost:9998 (if installed)

## Common Commands

```bash
# View service logs
docker-compose logs [service_name]

# Restart specific service
docker-compose restart fileflow-api

# Stop all services
docker-compose down

# Clean up (removes volumes)
docker-compose down -v

# Check service health
curl http://localhost:3000/health

# Monitor queue status
curl http://localhost:3000/api/v1/admin/queues

# Database shell access
docker-compose exec postgres psql -U fileflow -d fileflow_db

# Redis CLI access
docker-compose exec redis redis-cli -a redis_password

# MinIO CLI access
docker-compose exec minio mc ls local/
```

## Backup & Recovery

### Database Backup

```bash
# Backup database
docker-compose exec postgres pg_dump -U fileflow fileflow_db > backup.sql

# Restore database
docker-compose exec -T postgres psql -U fileflow fileflow_db < backup.sql
```

### File Storage Backup

```bash
# Backup MinIO data
docker-compose exec minio mc mirror local/fileflow-uploads ./backup/uploads/
docker-compose exec minio mc mirror local/fileflow-processed ./backup/processed/
docker-compose exec minio mc mirror local/fileflow-thumbnails ./backup/thumbnails/
```

## Monitoring Setup

### Health Check Endpoints

- `/health` - Overall system status
- `/health/ready` - Kubernetes readiness probe
- `/health/live` - Kubernetes liveness probe

### Prometheus Metrics (Optional)

Add to docker-compose.yml:

```yaml
prometheus:
  image: prom/prometheus
  ports:
    - "9090:9090"
  volumes:
    - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml

grafana:
  image: grafana/grafana
  ports:
    - "3001:3000"
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=admin
```

## Performance Tuning

### Database Optimization

```sql
-- Create additional indexes for better performance
CREATE INDEX CONCURRENTLY idx_files_status_created ON files(status, created_at);
CREATE INDEX CONCURRENTLY idx_file_metadata_text_search ON file_metadata USING gin(to_tsvector('english', extracted_text));
```

### Redis Optimization

```bash
# Increase Redis memory limit
echo "maxmemory 1gb" >> redis.conf
echo "maxmemory-policy allkeys-lru" >> redis.conf
```

### Worker Scaling

```bash
# Scale worker processes
docker-compose up -d --scale fileflow-worker=3
```

## Troubleshooting

### Common Issues

1. **Port conflicts**: Change ports in docker-compose.yml
2. **Out of disk space**: Clean up with `docker system prune`
3. **Memory issues**: Increase Docker Desktop memory allocation
4. **Permission errors**: Check file permissions and Docker access

### Debug Mode

```bash
# Enable debug logging
export LOG_LEVEL=debug
export DEBUG=*

# Start with verbose output
docker-compose up --no-daemon
```

### Reset Everything

```bash
# Complete reset (WARNING: destroys all data)
docker-compose down -v
docker system prune -a
npm run migrate
```

## Support

If you encounter issues:

1. Check the logs: `docker-compose logs`
2. Verify service health: `curl http://localhost:3000/health`
3. Review the troubleshooting section
4. Create an issue on GitHub with logs and error details