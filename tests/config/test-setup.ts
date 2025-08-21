import { chromium, FullConfig } from '@playwright/test';
import dotenv from 'dotenv';

/**
 * Global test setup - runs before all tests
 */
async function globalSetup(config: FullConfig) {
  // Load environment variables
  dotenv.config();

  console.log('🔧 Setting up test environment...');

  // Wait for servers to be ready
  console.log('⏳ Waiting for servers to be ready...');
  
  // Check if backend is ready
  await waitForServer('http://localhost:4000/graphql', 'Backend GraphQL');
  
  // Check if frontend is ready
  await waitForServer('http://localhost:3000', 'Frontend App');

  console.log('✅ Test environment setup complete!');
}

/**
 * Wait for a server to be ready by making HTTP requests
 */
async function waitForServer(url: string, name: string, maxRetries = 30, delay = 2000) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await page.goto(url, { 
        timeout: 5000, 
        waitUntil: 'domcontentloaded' 
      });
      
      if (response?.ok()) {
        console.log(`✅ ${name} is ready at ${url}`);
        await browser.close();
        return;
      }
    } catch (error) {
      // Server not ready yet, continue waiting
    }
    
    console.log(`⏳ Waiting for ${name} (attempt ${i + 1}/${maxRetries})...`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  await browser.close();
  throw new Error(`❌ ${name} failed to start after ${maxRetries} attempts`);
}

export default globalSetup;