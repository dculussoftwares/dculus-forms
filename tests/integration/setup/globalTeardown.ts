export default async function globalTeardown() {
  console.log('🧹 Starting integration test teardown...');
  
  // Perform any global cleanup if needed
  // For now, just log completion
  
  console.log('✅ Global teardown complete');
}