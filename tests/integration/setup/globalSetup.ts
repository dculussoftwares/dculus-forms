import dotenv from 'dotenv';
import path from 'path';

export default async function globalSetup() {
  // Load integration test environment variables
  dotenv.config({ path: path.join(__dirname, '../..', '.env.integration') });
  
  console.log('🚀 Starting integration test setup...');
  console.log('📋 Environment variables loaded from .env.integration');
  console.log(`🎯 Backend URL: ${process.env.BACKEND_URL}`);
  console.log(`🏥 Health endpoint: ${process.env.HEALTH_ENDPOINT}`);
  
  // Wait a bit to ensure all services are ready
  console.log('⏳ Waiting for services to be ready...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('✅ Global setup complete');
}