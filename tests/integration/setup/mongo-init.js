// MongoDB initialization script for integration tests
// This script runs when the MongoDB container starts

// Switch to the test database
db = db.getSiblingDB('dculus_test');

// Create a test user with read/write permissions
db.createUser({
  user: 'test_user',
  pwd: 'test_password',
  roles: [
    {
      role: 'readWrite',
      db: 'dculus_test'
    }
  ]
});

// Create collections that will be used by the application
db.createCollection('user');
db.createCollection('account');
db.createCollection('session');
db.createCollection('organization');
db.createCollection('member');
db.createCollection('invitation');
db.createCollection('form');
db.createCollection('response');
db.createCollection('form_template');
db.createCollection('verification');
db.createCollection('collaborative_document');
db.createCollection('form_metadata');
db.createCollection('form_file');

print('MongoDB initialized for integration tests');