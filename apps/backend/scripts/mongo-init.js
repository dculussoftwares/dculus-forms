// MongoDB initialization script for replica set
print('MongoDB initialization script starting...');

// Switch to admin database
db = db.getSiblingDB('admin');

// Create admin user if it doesn't exist
try {
  db.createUser({
    user: process.env.MONGO_INITDB_ROOT_USERNAME || 'admin',
    pwd: process.env.MONGO_INITDB_ROOT_PASSWORD || 'password123',
    roles: [
      {
        role: 'userAdminAnyDatabase',
        db: 'admin'
      },
      {
        role: 'readWriteAnyDatabase',
        db: 'admin'
      },
      {
        role: 'dbAdminAnyDatabase',
        db: 'admin'
      },
      {
        role: 'clusterAdmin',
        db: 'admin'
      }
    ]
  });
  print('Admin user created successfully');
} catch (error) {
  print('Admin user already exists or error creating: ' + error);
}

// Switch to application database
db = db.getSiblingDB(process.env.MONGO_INITDB_DATABASE || 'dculus_forms');

// Create application user if it doesn't exist
try {
  db.createUser({
    user: process.env.MONGO_INITDB_ROOT_USERNAME || 'admin',
    pwd: process.env.MONGO_INITDB_ROOT_PASSWORD || 'password123',
    roles: [
      {
        role: 'readWrite',
        db: process.env.MONGO_INITDB_DATABASE || 'dculus_forms'
      }
    ]
  });
  print('Application user created successfully');
} catch (error) {
  print('Application user already exists or error creating: ' + error);
}

print('MongoDB initialization script completed');