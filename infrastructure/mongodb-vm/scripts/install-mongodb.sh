#!/bin/bash

# MongoDB Community Edition Installation Script for Ubuntu 22.04
# This script is executed via cloud-init during VM provisioning

set -e  # Exit on any error

# Variables from Terraform template
MONGODB_VERSION="${MONGODB_VERSION}"
MONGODB_PORT="${MONGODB_PORT}"

# Log all output for debugging
exec > >(tee -a /var/log/mongodb-install.log)
exec 2>&1

echo "=== MongoDB Installation Started at $(date) ==="

# Update system packages
echo "Updating system packages..."
apt-get update -y

# Install prerequisite packages
echo "Installing prerequisite packages..."
apt-get install -y software-properties-common gnupg apt-transport-https ca-certificates curl

# Import MongoDB GPG key
echo "Importing MongoDB GPG key..."
curl -fsSL https://pgp.mongodb.com/server-${MONGODB_VERSION}.asc | gpg -o /usr/share/keyrings/mongodb-server-${MONGODB_VERSION}.gpg --dearmor

# Add MongoDB repository
echo "Adding MongoDB repository..."
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-${MONGODB_VERSION}.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/${MONGODB_VERSION} multiverse" | tee /etc/apt/sources.list.d/mongodb-org-${MONGODB_VERSION}.list

# Update package list with MongoDB repository
echo "Updating package list..."
apt-get update -y

# Install MongoDB
echo "Installing MongoDB Community Edition ${MONGODB_VERSION}..."
apt-get install -y mongodb-org

# Pin MongoDB packages to prevent unintended upgrades
echo "mongodb-org hold" | dpkg --set-selections
echo "mongodb-org-database hold" | dpkg --set-selections
echo "mongodb-org-server hold" | dpkg --set-selections
echo "mongodb-mongosh hold" | dpkg --set-selections
echo "mongodb-org-mongos hold" | dpkg --set-selections
echo "mongodb-org-tools hold" | dpkg --set-selections

# Create MongoDB data directory
echo "Creating MongoDB data directories..."
mkdir -p /var/lib/mongodb
mkdir -p /var/log/mongodb
chown mongodb:mongodb /var/lib/mongodb
chown mongodb:mongodb /var/log/mongodb

# Configure MongoDB for remote access
echo "Configuring MongoDB for remote access..."
cat > /etc/mongod.conf << EOF
# MongoDB Configuration File

# Storage settings
storage:
  dbPath: /var/lib/mongodb
  journal:
    enabled: true

# System log settings
systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log

# Network settings - Allow remote connections
net:
  port: ${MONGODB_PORT}
  bindIp: 0.0.0.0  # Listen on all interfaces

# Process management
processManagement:
  fork: true
  pidFilePath: /var/run/mongodb/mongod.pid
  timeZoneInfo: /usr/share/zoneinfo

# Security settings - Enable authentication
security:
  authorization: enabled
EOF

# Configure firewall to allow MongoDB port
echo "Configuring firewall..."
ufw --force enable
ufw allow ssh
ufw allow ${MONGODB_PORT}/tcp
ufw --force reload

# Start and enable MongoDB service
echo "Starting MongoDB service..."
systemctl start mongod
systemctl enable mongod

# Wait for MongoDB to start
echo "Waiting for MongoDB to start..."
sleep 10

# Create MongoDB admin user
echo "Creating MongoDB admin user..."
mongosh --eval "
admin = db.getSiblingDB('admin');
admin.createUser({
  user: 'admin',
  pwd: 'SecureAdminPassword123!',
  roles: [
    { role: 'userAdminAnyDatabase', db: 'admin' },
    { role: 'readWriteAnyDatabase', db: 'admin' },
    { role: 'dbAdminAnyDatabase', db: 'admin' },
    { role: 'clusterAdmin', db: 'admin' }
  ]
});
print('Admin user created successfully');
"

# Create application database and user
echo "Creating application database and user..."
mongosh --eval "
admin = db.getSiblingDB('admin');
admin.auth('admin', 'SecureAdminPassword123!');

appDb = db.getSiblingDB('dculus_forms');
appDb.createUser({
  user: 'dculus_app',
  pwd: 'DculusAppPassword123!',
  roles: [
    { role: 'readWrite', db: 'dculus_forms' }
  ]
});
print('Application user created successfully');
"

# Restart MongoDB with authentication enabled
echo "Restarting MongoDB with authentication enabled..."
systemctl restart mongod

# Wait for MongoDB to restart
sleep 10

# Verify MongoDB is running
echo "Verifying MongoDB installation..."
if systemctl is-active --quiet mongod; then
    echo "✅ MongoDB is running successfully"
else
    echo "❌ MongoDB failed to start"
    systemctl status mongod
    exit 1
fi

# Test MongoDB connection
echo "Testing MongoDB connection..."
mongosh --username admin --password SecureAdminPassword123! --authenticationDatabase admin --eval "db.adminCommand('ismaster')" || {
    echo "❌ MongoDB connection test failed"
    exit 1
}

# Create installation info file
cat > /home/azureuser/mongodb-info.txt << EOF
=== MongoDB Community Edition ${MONGODB_VERSION} Installation Complete ===

Server Details:
- MongoDB Version: ${MONGODB_VERSION}
- Port: ${MONGODB_PORT}
- Data Directory: /var/lib/mongodb
- Log File: /var/log/mongodb/mongod.log
- Configuration: /etc/mongod.conf

Admin Credentials:
- Username: admin
- Password: SecureAdminPassword123!
- Database: admin

Application Credentials:
- Username: dculus_app
- Password: DculusAppPassword123!
- Database: dculus_forms

Connection Examples:
- Admin: mongosh "mongodb://admin:SecureAdminPassword123!@localhost:${MONGODB_PORT}/admin"
- App: mongosh "mongodb://dculus_app:DculusAppPassword123!@localhost:${MONGODB_PORT}/dculus_forms"

Remote Connection String (replace <VM_IP> with actual IP):
mongodb://dculus_app:DculusAppPassword123!@<VM_IP>:${MONGODB_PORT}/dculus_forms

Service Management:
- Start: sudo systemctl start mongod
- Stop: sudo systemctl stop mongod
- Status: sudo systemctl status mongod
- Logs: sudo tail -f /var/log/mongodb/mongod.log

Installation completed at: $(date)
EOF

chown azureuser:azureuser /home/azureuser/mongodb-info.txt

echo "=== MongoDB Installation Completed Successfully at $(date) ==="
echo "📄 Installation details saved to: /home/azureuser/mongodb-info.txt"