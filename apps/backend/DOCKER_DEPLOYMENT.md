# Docker Deployment Guide for Dculus Forms Backend

This guide explains how to build and deploy the backend service using Docker, with proper environment variable management for different deployment scenarios.

## 🔒 Security Overview

The Docker setup follows security best practices:
- ✅ **No `.env` files in Docker images** - Environment variables are injected at runtime
- ✅ **Non-root user execution** - Container runs as `backend` user (UID 1001)
- ✅ **Minimal production image** - Multi-stage build with only production dependencies
- ✅ **Health checks** - Built-in health monitoring
- ✅ **Proper secret management** - Environment variables handled securely

## 🏗️ Building the Docker Image

### Local Development Build
```bash
# Navigate to backend directory
cd apps/backend

# Build the Docker image
docker build -t dculus-backend:latest .

# Or build with a specific tag
docker build -t dculus-backend:v1.0.0 .
```

### CI/CD Pipeline Build
```bash
# Example for GitHub Actions or other CI/CD
docker build -t your-registry/dculus-backend:${{github.sha}} .
docker push your-registry/dculus-backend:${{github.sha}}
```

## 🚀 Running the Docker Container

### Option 1: Using Docker Compose (Recommended for Local Development)

```bash
# Start all services (backend + MongoDB)
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down
```

### Option 2: Docker Run with Environment Variables

```bash
# Run with individual environment variables
docker run -d \
  --name dculus-backend \
  -p 4000:4000 \
  -e DATABASE_URL="mongodb://localhost:27017/dculus_forms?replicaSet=rs0&retryWrites=true&w=majority" \
  -e JWT_SECRET="your-super-secret-jwt-key-change-in-production-make-it-at-least-32-characters" \
  -e BETTER_AUTH_SECRET="your-super-secret-key-change-this-in-production-make-it-at-least-32-characters" \
  -e BETTER_AUTH_URL="http://localhost:4000" \
  -e NODE_ENV="production" \
  -e PORT="4000" \
  dculus-backend:latest
```

### Option 3: Docker Run with Environment File

```bash
# Create a production.env file with your environment variables
# DO NOT commit this file to version control!

docker run -d \
  --name dculus-backend \
  -p 4000:4000 \
  --env-file production.env \
  dculus-backend:latest
```

## 🔧 Environment Variables

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | MongoDB connection string | `mongodb://localhost:27017/dculus_forms?replicaSet=rs0` |
| `JWT_SECRET` | Secret key for JWT tokens (min 32 chars) | `your-super-secret-jwt-key-change-in-production` |
| `BETTER_AUTH_SECRET` | Secret key for Better Auth (min 32 chars) | `your-super-secret-key-change-this-in-production` |

### Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BETTER_AUTH_URL` | `http://localhost:4000` | Base URL for Better Auth |
| `NODE_ENV` | `production` | Node.js environment |
| `PORT` | `4000` | Server port |
| `BASE_URL` | `http://localhost:4000` | Application base URL |

### Cloudflare R2 Storage (Optional)

| Variable | Description |
|----------|-------------|
| `CLOUDFLARE_R2_ACCESS_KEY` | Cloudflare R2 access key |
| `CLOUDFLARE_R2_SECRET_KEY` | Cloudflare R2 secret key |
| `CLOUDFLARE_R2_ENDPOINT` | Cloudflare R2 endpoint URL |
| `CLOUDFLARE_R2_PRIVATE_BUCKET_NAME` | Private bucket name |
| `CLOUDFLARE_R2_PUBLIC_BUCKET_NAME` | Public bucket name |

## 🏭 CI/CD Pipeline Examples

### GitHub Actions

```yaml
name: Build and Deploy Backend

on:
  push:
    branches: [main]
    paths: ['apps/backend/**']

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Build Docker image
      run: |
        cd apps/backend
        docker build -t dculus-backend:${{ github.sha }} .
    
    - name: Deploy to production
      run: |
        docker run -d \
          --name dculus-backend \
          -p 4000:4000 \
          -e DATABASE_URL="${{ secrets.DATABASE_URL }}" \
          -e JWT_SECRET="${{ secrets.JWT_SECRET }}" \
          -e BETTER_AUTH_SECRET="${{ secrets.BETTER_AUTH_SECRET }}" \
          -e BETTER_AUTH_URL="${{ secrets.BETTER_AUTH_URL }}" \
          -e CLOUDFLARE_R2_ACCESS_KEY="${{ secrets.CLOUDFLARE_R2_ACCESS_KEY }}" \
          -e CLOUDFLARE_R2_SECRET_KEY="${{ secrets.CLOUDFLARE_R2_SECRET_KEY }}" \
          -e CLOUDFLARE_R2_ENDPOINT="${{ secrets.CLOUDFLARE_R2_ENDPOINT }}" \
          -e CLOUDFLARE_R2_PRIVATE_BUCKET_NAME="${{ secrets.CLOUDFLARE_R2_PRIVATE_BUCKET_NAME }}" \
          -e CLOUDFLARE_R2_PUBLIC_BUCKET_NAME="${{ secrets.CLOUDFLARE_R2_PUBLIC_BUCKET_NAME }}" \
          dculus-backend:${{ github.sha }}
```

### GitLab CI

```yaml
build-backend:
  stage: build
  script:
    - cd apps/backend
    - docker build -t $CI_REGISTRY_IMAGE/backend:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE/backend:$CI_COMMIT_SHA

deploy-backend:
  stage: deploy
  script:
    - docker run -d 
        --name dculus-backend 
        -p 4000:4000 
        -e DATABASE_URL="$DATABASE_URL"
        -e JWT_SECRET="$JWT_SECRET"
        -e BETTER_AUTH_SECRET="$BETTER_AUTH_SECRET"
        $CI_REGISTRY_IMAGE/backend:$CI_COMMIT_SHA
```

## ☸️ Kubernetes Deployment

### ConfigMap for Non-Sensitive Configuration

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: backend-config
data:
  NODE_ENV: "production"
  PORT: "4000"
  BETTER_AUTH_URL: "https://your-domain.com"
  BASE_URL: "https://your-domain.com"
```

### Secret for Sensitive Configuration

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: backend-secrets
type: Opaque
stringData:
  DATABASE_URL: "mongodb://mongodb:27017/dculus_forms?replicaSet=rs0"
  JWT_SECRET: "your-super-secret-jwt-key-change-in-production"
  BETTER_AUTH_SECRET: "your-super-secret-key-change-this-in-production"
  CLOUDFLARE_R2_ACCESS_KEY: "your-cloudflare-r2-access-key"
  CLOUDFLARE_R2_SECRET_KEY: "your-cloudflare-r2-secret-key"
  CLOUDFLARE_R2_ENDPOINT: "https://your-account-id.r2.cloudflarestorage.com"
  CLOUDFLARE_R2_PRIVATE_BUCKET_NAME: "your-private-bucket-name"
  CLOUDFLARE_R2_PUBLIC_BUCKET_NAME: "your-public-bucket-name"
```

### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: dculus-backend:latest
        ports:
        - containerPort: 4000
        envFrom:
        - configMapRef:
            name: backend-config
        - secretRef:
            name: backend-secrets
        livenessProbe:
          httpGet:
            path: /health
            port: 4000
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 4000
          initialDelaySeconds: 5
          periodSeconds: 5
```

## 🔍 Health Checks and Monitoring

### Built-in Health Check

The Docker image includes a health check that monitors the `/health` endpoint:

```bash
# Check container health
docker ps
# Look for "healthy" status

# View health check logs
docker inspect dculus-backend | grep -A 5 "Health"
```

### Manual Health Check

```bash
# Test the health endpoint
curl http://localhost:4000/health

# Expected response: {"status": "ok", "timestamp": "..."}
```

## 🛠️ Troubleshooting

### Common Issues

1. **Container won't start**
   ```bash
   # Check logs
   docker logs dculus-backend
   
   # Check if all required environment variables are set
   docker exec dculus-backend env | grep -E "(DATABASE_URL|JWT_SECRET|BETTER_AUTH_SECRET)"
   ```

2. **Database connection issues**
   ```bash
   # Test MongoDB connectivity
   docker exec dculus-backend node -e "
   const { MongoClient } = require('mongodb');
   MongoClient.connect(process.env.DATABASE_URL).then(() => {
     console.log('Database connected successfully');
     process.exit(0);
   }).catch(err => {
     console.error('Database connection failed:', err);
     process.exit(1);
   });
   "
   ```

3. **Permission issues**
   ```bash
   # Check if container is running as non-root user
   docker exec dculus-backend id
   # Should show: uid=1001(backend) gid=1001(nodejs)
   ```

### Development vs Production

**Development:**
- Use `docker-compose.yml` with `.env` file
- Includes MongoDB service
- Volume mounts for development

**Production:**
- Use individual `docker run` commands or Kubernetes
- External database service
- Environment variables from CI/CD secrets
- No `.env` files in production

## 📝 Best Practices

1. **Never commit `.env` files** to version control
2. **Use separate environment files** for different environments
3. **Rotate secrets regularly** in production
4. **Monitor health checks** and set up alerts
5. **Use specific image tags** instead of `latest` in production
6. **Implement proper logging** and monitoring
7. **Run security scans** on Docker images before deployment
8. **Use non-root users** in containers (already implemented)
9. **Keep images minimal** and updated (multi-stage build implemented)
10. **Implement proper backup strategies** for databases