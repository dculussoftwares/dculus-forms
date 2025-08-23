// MongoDB initialization script - Create application user
// This replicates the user management from the VM deployment

print('MongoDB Initialization Script Starting...');

// Switch to the application database
db = db.getSiblingDB('${app_database}');

// Create application user with read/write permissions (like VM dculus_app user)
try {
    db.createUser({
        user: '${app_username}',
        pwd: '${app_password}',
        roles: [
            {
                role: 'readWrite',
                db: '${app_database}'
            },
            {
                role: 'dbAdmin',
                db: '${app_database}'
            }
        ]
    });
    print('Successfully created application user: ${app_username}');
} catch (e) {
    if (e.codeName === 'DuplicateKey') {
        print('Application user ${app_username} already exists, skipping creation');
    } else {
        print('Error creating application user: ' + e.message);
        throw e;
    }
}

// Create a test collection to ensure database is properly initialized
try {
    db.createCollection('forms');
    print('Created forms collection in ${app_database}');
    
    // Insert a test document
    db.forms.insertOne({
        _id: 'init_test',
        name: 'Initialization Test Form',
        created: new Date(),
        status: 'active'
    });
    print('Inserted initialization test document');
} catch (e) {
    print('Note: Collection may already exist - ' + e.message);
}

// Display connection information for verification
print('');
print('=== MongoDB Container App Initialization Complete ===');
print('Database: ${app_database}');
print('Application User: ${app_username}');
print('Connection String: mongodb://${app_username}:[PASSWORD]@hostname:27017/${app_database}');
print('Admin Connection: mongodb://admin:[ADMIN_PASSWORD]@hostname:27017/admin');
print('');
print('Container App Features:');
print('- Internal networking (secure by default)');
print('- Persistent storage with Azure Files');
print('- Latest MongoDB 8.0 with optimized configuration');
print('- Auto-scaling based on demand');
print('');