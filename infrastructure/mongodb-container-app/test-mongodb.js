// MongoDB Container App Test Script
// This script tests the MongoDB deployment similar to VM approach

const { MongoClient } = require('mongodb');

// Connection configurations from VM approach
const configs = {
    admin: {
        uri: 'mongodb://admin:SecureMongoDB2025!@#$@dculus-mongodb-7177:27017/admin',
        description: 'Admin connection (like VM admin user)'
    },
    app: {
        uri: 'mongodb://admin:SecureMongoDB2025!@#$@dculus-mongodb-7177:27017/dculus_forms',
        description: 'Application database connection'
    }
};

async function testConnection(config) {
    console.log(`\n🧪 Testing: ${config.description}`);
    console.log(`📍 URI: ${config.uri.replace(/:([^:@]+)@/, ':***@')}`);
    
    try {
        const client = new MongoClient(config.uri, {
            connectTimeoutMS: 5000,
            serverSelectionTimeoutMS: 5000,
        });
        
        await client.connect();
        console.log('✅ Connection successful');
        
        // Test basic operations
        const db = client.db();
        
        // Test ping
        const pingResult = await db.admin().ping();
        console.log('✅ Ping successful:', pingResult);
        
        // Test collection operations
        const testCollection = db.collection('test_collection');
        
        // Insert test document
        const insertResult = await testCollection.insertOne({
            test: true,
            timestamp: new Date(),
            message: 'Container App MongoDB Test',
            deployment: 'Azure Container Apps 2025'
        });
        console.log('✅ Insert successful:', insertResult.insertedId);
        
        // Query test document
        const findResult = await testCollection.findOne({ test: true });
        console.log('✅ Query successful:', findResult ? 'Found test document' : 'No document found');
        
        // List collections
        const collections = await db.listCollections().toArray();
        console.log('✅ Collections:', collections.map(c => c.name));
        
        await client.close();
        console.log('✅ Connection closed successfully');
        
        return true;
    } catch (error) {
        console.log('❌ Error:', error.message);
        return false;
    }
}

async function runTests() {
    console.log('🚀 MongoDB Container App Connection Tests');
    console.log('==========================================');
    
    const results = {};
    
    for (const [key, config] of Object.entries(configs)) {
        results[key] = await testConnection(config);
    }
    
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    
    Object.entries(results).forEach(([key, success]) => {
        console.log(`${success ? '✅' : '❌'} ${key}: ${success ? 'PASSED' : 'FAILED'}`);
    });
    
    const allPassed = Object.values(results).every(r => r);
    
    console.log(`\n🎯 Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
    if (allPassed) {
        console.log('\n🎉 MongoDB Container App is working correctly!');
        console.log('📝 Connection Details:');
        console.log('   - Internal FQDN: dculus-mongodb-7177');
        console.log('   - Port: 27017');
        console.log('   - Database: dculus_forms');
        console.log('   - Admin User: admin');
        console.log('   - Status: Ready for application connections');
    }
    
    return allPassed;
}

// Run tests if this script is executed directly
if (require.main === module) {
    runTests().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { runTests, testConnection };