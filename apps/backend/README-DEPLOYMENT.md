# Dculus Forms Backend - Deployment Guide

This guide covers deploying the Dculus Forms backend using either **Docker** (recommended) or **Node.js directly** from the ZIP artifact.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Method 1: Docker Deployment (Recommended)](#method-1-docker-deployment-recommended)
- [Method 2: Node.js Direct Deployment](#method-2-nodejs-direct-deployment)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Production Best Practices](#production-best-practices)
- [Process Management](#process-management)
- [Monitoring & Health Checks](#monitoring--health-checks)
- [Troubleshooting](#troubleshooting)

## Prerequisites

**For Docker deployment:**
- Docker Engine 20.10+ or Docker Desktop
- Docker Compose (optional, for easier management)

**For Node.js deployment:**
- Node.js 18.x or higher
- pnpm 8.x or npm/yarn
- Linux/macOS/Windows with bash support

**Common requirements:**
- MongoDB 5.0+ (local, MongoDB Atlas, or managed service)
- S3-compatible storage (AWS S3, MinIO, DigitalOcean Spaces, etc.)
- Minimum 512MB RAM, 1GB+ recommended
- Port 4000 available (or configure PORT environment variable)

## Method 1: Docker Deployment (Recommended)

Docker deployment provides the most consistent and reliable experience across all platforms.

### Using Docker Hub Image

**Step 1: Pull the image**
```bash
docker pull dculus/forms-backend:v1.0.0
# Or for latest:
docker pull dculus/forms-backend:latest
```

**Step 2: Create environment file**
```bash
# Create .env file with your configuration
cat > .env << 'EOF'
DATABASE_URL=mongodb+srv://user:pass@cluster.mongodb.net/dculus_forms
BETTER_AUTH_SECRET=your-secret-min-32-characters
BETTER_AUTH_URL=https://api.yourdomain.com
CORS_ORIGINS=https://app.yourdomain.com,https://admin.yourdomain.com
PUBLIC_S3_ACCESS_KEY=your-access-key
PUBLIC_S3_SECRET_KEY=your-secret-key
PUBLIC_S3_ENDPOINT=https://s3.amazonaws.com
S3_REGION=us-east-1
PRIVATE_S3_BUCKET_NAME=dculus-private
PUBLIC_S3_BUCKET_NAME=dculus-public
EOF
```

**Step 3: Run the container**
```bash
docker run -d \
  --name dculus-backend \
  -p 4000:4000 \
  --env-file .env \
  --restart unless-stopped \
  dculus/forms-backend:v1.0.0
```

**Step 4: Verify deployment**
```bash
# Check container status
docker ps | grep dculus-backend

# Check logs
docker logs dculus-backend

# Test health endpoint
curl http://localhost:4000/health
```

### Using Docker Compose

**Step 1: Create docker-compose.yml**
```yaml
version: '3.8'

services:
  backend:
    image: dculus/forms-backend:v1.0.0
    container_name: dculus-backend
    ports:
      - "4000:4000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
      - BETTER_AUTH_URL=${BETTER_AUTH_URL}
      - CORS_ORIGINS=${CORS_ORIGINS}
      - PUBLIC_S3_ACCESS_KEY=${PUBLIC_S3_ACCESS_KEY}
      - PUBLIC_S3_SECRET_KEY=${PUBLIC_S3_SECRET_KEY}
      - PUBLIC_S3_ENDPOINT=${PUBLIC_S3_ENDPOINT}
      - S3_REGION=${S3_REGION}
      - PRIVATE_S3_BUCKET_NAME=${PRIVATE_S3_BUCKET_NAME}
      - PUBLIC_S3_BUCKET_NAME=${PUBLIC_S3_BUCKET_NAME}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - dculus-network

networks:
  dculus-network:
    driver: bridge
```

**Step 2: Create .env file** (same as above)

**Step 3: Start the service**
```bash
docker-compose up -d
```

**Step 4: Manage the service**
```bash
# View logs
docker-compose logs -f backend

# Restart
docker-compose restart backend

# Stop
docker-compose down

# Update to new version
docker-compose pull
docker-compose up -d
```

## Method 2: Node.js Direct Deployment

Deploy from the ZIP artifact when you prefer running Node.js directly or have resource constraints.

### Step 1: Download and Extract

```bash
# Download the backend ZIP from GitHub Releases
wget https://github.com/your-org/dculus-forms/releases/download/v1.0.0/backend-build-v1.0.0.zip

# Extract
unzip backend-build-v1.0.0.zip
cd backend-build-v1.0.0
```

### Step 2: Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit with your actual values
nano .env  # or vim, vi, etc.
```

**Required environment variables:**
```bash
DATABASE_URL=mongodb+srv://user:pass@cluster.mongodb.net/dculus_forms
BETTER_AUTH_SECRET=$(openssl rand -hex 32)
BETTER_AUTH_URL=https://api.yourdomain.com
CORS_ORIGINS=https://app.yourdomain.com,https://admin.yourdomain.com
PUBLIC_S3_ACCESS_KEY=your-access-key
PUBLIC_S3_SECRET_KEY=your-secret-key
PUBLIC_S3_ENDPOINT=https://s3.amazonaws.com
S3_REGION=us-east-1
PRIVATE_S3_BUCKET_NAME=dculus-private
PUBLIC_S3_BUCKET_NAME=dculus-public
```

### Step 3: Install Dependencies (if not included)

The ZIP artifact includes `node_modules`, but if you need to reinstall:

```bash
# Using pnpm (recommended)
pnpm install --prod --frozen-lockfile

# Or using npm
npm ci --only=production
```

### Step 4: Run the Application

**Development/Testing:**
```bash
node dist/apps/backend/src/index.js
```

**Production (with PM2 - recommended):**
```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start dist/apps/backend/src/index.js \
  --name dculus-backend \
  --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Follow the instructions printed
```

**Production (with systemd):**

Create `/etc/systemd/system/dculus-backend.service`:

```ini
[Unit]
Description=Dculus Forms Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/dculus-backend
EnvironmentFile=/var/www/dculus-backend/.env
ExecStart=/usr/bin/node dist/apps/backend/src/index.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=dculus-backend

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable dculus-backend
sudo systemctl start dculus-backend
sudo systemctl status dculus-backend
```

## Environment Configuration

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/dculus_forms` |
| `BETTER_AUTH_SECRET` | Authentication secret (min 32 chars) | Generate with `openssl rand -hex 32` |
| `BETTER_AUTH_URL` | Public API URL | `https://api.yourdomain.com` |
| `CORS_ORIGINS` | Allowed frontend origins (comma-separated) | `https://app.example.com,https://admin.example.com` |
| `PUBLIC_S3_ACCESS_KEY` | S3 access key | Your S3 access key |
| `PUBLIC_S3_SECRET_KEY` | S3 secret key | Your S3 secret key |
| `PUBLIC_S3_ENDPOINT` | S3 endpoint URL | `https://s3.amazonaws.com` |
| `S3_REGION` | S3 region | `us-east-1` |
| `PRIVATE_S3_BUCKET_NAME` | Private files bucket | `dculus-forms-private` |
| `PUBLIC_S3_BUCKET_NAME` | Public files bucket | `dculus-forms-public` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port | `4000` |
| `PUBLIC_S3_CDN_URL` | CDN URL for public files | S3 endpoint |
| `ADMIN_EMAIL` | Initial admin email | - |
| `ADMIN_PASSWORD` | Initial admin password | - |
| `ADMIN_NAME` | Initial admin name | - |

## Database Setup

### Using MongoDB Atlas (Recommended for Cloud)

1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Create a database user with read/write permissions
3. Whitelist your server's IP address (or 0.0.0.0/0 for testing)
4. Get the connection string from "Connect" → "Connect your application"
5. Set `DATABASE_URL` in your `.env` file

### Using Self-Hosted MongoDB

```bash
# Install MongoDB (Ubuntu/Debian)
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Create admin user
mongo
> use admin
> db.createUser({
    user: "admin",
    pwd: "your-password",
    roles: ["root"]
  })

# Update DATABASE_URL
DATABASE_URL="mongodb://admin:your-password@localhost:27017/dculus_forms?authSource=admin"
```

## Production Best Practices

### Security

1. **Use strong secrets:**
   ```bash
   # Generate secure secrets
   openssl rand -hex 32  # For BETTER_AUTH_SECRET
   ```

2. **Restrict CORS origins:**
   ```bash
   # Only allow your actual frontend domains
   CORS_ORIGINS=https://app.yourdomain.com,https://admin.yourdomain.com
   # Never use * in production
   ```

3. **Use HTTPS:**
   - Deploy behind nginx or Caddy with SSL/TLS
   - Use Let's Encrypt for free SSL certificates

4. **Environment variable security:**
   ```bash
   # Secure .env file permissions
   chmod 600 .env
   chown www-data:www-data .env
   ```

### Performance

1. **Enable MongoDB indexes:**
   ```javascript
   // Prisma automatically creates indexes from schema.prisma
   // Verify with: db.collection.getIndexes()
   ```

2. **Configure connection pooling:**
   ```bash
   # Add to DATABASE_URL
   ?maxPoolSize=10&minPoolSize=2
   ```

3. **Use a reverse proxy:**
   ```nginx
   # nginx configuration
   server {
       listen 443 ssl http2;
       server_name api.yourdomain.com;

       ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

       location / {
           proxy_pass http://localhost:4000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

### Reliability

1. **Use process manager (PM2 or systemd)** - Auto-restart on crashes
2. **Configure health checks** - Monitor `/health` endpoint
3. **Set up logging** - Use centralized logging (ELK, CloudWatch, etc.)
4. **Regular backups** - Backup MongoDB data daily

## Process Management

### Using PM2

```bash
# Start
pm2 start dist/apps/backend/src/index.js --name dculus-backend

# Monitor
pm2 monit

# Logs
pm2 logs dculus-backend

# Restart
pm2 restart dculus-backend

# Stop
pm2 stop dculus-backend

# Delete
pm2 delete dculus-backend

# Startup script
pm2 startup
pm2 save
```

### Using systemd

```bash
# Start
sudo systemctl start dculus-backend

# Stop
sudo systemctl stop dculus-backend

# Restart
sudo systemctl restart dculus-backend

# View status
sudo systemctl status dculus-backend

# View logs
sudo journalctl -u dculus-backend -f
```

## Monitoring & Health Checks

### Health Endpoint

```bash
# Check if backend is running
curl http://localhost:4000/health

# Expected response:
{"status":"ok"}
```

### Monitoring with Uptime Kuma

```bash
# Install Uptime Kuma (optional)
docker run -d \
  --name uptime-kuma \
  -p 3001:3001 \
  -v uptime-kuma:/app/data \
  louislam/uptime-kuma:1

# Add monitor for http://your-api-url/health
```

### Application Metrics

```bash
# PM2 monitoring
pm2 monit

# System resources
htop
```

## Troubleshooting

### Backend won't start

```bash
# Check logs
docker logs dculus-backend  # Docker
pm2 logs dculus-backend    # PM2
journalctl -u dculus-backend -f  # systemd

# Common issues:
# 1. Port 4000 already in use
sudo lsof -i :4000
# Kill the process or change PORT in .env

# 2. Database connection failed
# Verify DATABASE_URL is correct
# Check MongoDB is running
# Verify network/firewall rules
```

### Database connection errors

```bash
# Test MongoDB connection
mongo "$DATABASE_URL"

# For MongoDB Atlas:
# - Check IP whitelist
# - Verify username/password
# - Ensure database user has correct permissions
```

### File upload errors

```bash
# Verify S3 credentials
aws s3 ls s3://your-bucket-name

# Check bucket CORS configuration
# Check bucket permissions (public bucket needs public read)
```

### CORS errors

```bash
# Add your frontend URL to CORS_ORIGINS
CORS_ORIGINS=https://app.yourdomain.com,https://admin.yourdomain.com

# Restart the backend after changing .env
```

### High memory usage

```bash
# Check Node.js process
ps aux | grep node

# Limit memory (PM2)
pm2 start dist/apps/backend/src/index.js \
  --name dculus-backend \
  --max-memory-restart 500M

# Check for memory leaks with PM2
pm2 monit
```

## Support

For issues, questions, or contributions:
- **GitHub Issues**: https://github.com/your-org/dculus-forms/issues
- **Documentation**: See main README.md and DEPLOYMENT_GUIDE.md
- **Health Check**: Always test `http://your-api-url/health` first

## Comparison: Docker vs Node.js

| Feature | Docker | Node.js Direct |
|---------|--------|----------------|
| **Setup complexity** | Low | Medium |
| **Resource usage** | ~500MB RAM | ~300MB RAM |
| **Isolation** | ✅ Complete | ❌ Shared |
| **Portability** | ✅ Very high | ⚠️  Platform-dependent |
| **Updates** | `docker pull` | Re-download ZIP |
| **Debugging** | `docker logs` | Direct access |
| **Production ready** | ✅ Yes | ✅ Yes (with PM2) |
| **Recommended for** | Cloud, containers | VPS, dedicated servers |

Both methods are production-ready when properly configured!
