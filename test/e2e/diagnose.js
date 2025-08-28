#!/usr/bin/env node

/**
 * E2E Test Diagnostic Script
 * Run this to identify issues with your e2e test setup
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

console.log('🔍 E2E Test Diagnostics\n');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(color, symbol, message) {
  console.log(`${colors[color]}${symbol} ${message}${colors.reset}`);
}

// Check if URL is accessible
function checkURL(url, name) {
  return new Promise((resolve) => {
    const request = http.get(url, (res) => {
      if (res.statusCode < 400) {
        log('green', '✅', `${name} is accessible (${res.statusCode})`);
        resolve(true);
      } else {
        log('red', '❌', `${name} returned status ${res.statusCode}`);
        resolve(false);
      }
    });
    
    request.on('error', () => {
      log('red', '❌', `${name} is not accessible`);
      resolve(false);
    });
    
    request.setTimeout(5000, () => {
      log('red', '❌', `${name} timed out`);
      request.destroy();
      resolve(false);
    });
  });
}

// Check if file exists
function checkFile(filePath, name) {
  if (fs.existsSync(filePath)) {
    log('green', '✅', `${name} exists`);
    return true;
  } else {
    log('red', '❌', `${name} missing: ${filePath}`);
    return false;
  }
}

// Check if directory exists
function checkDirectory(dirPath, name) {
  if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
    log('green', '✅', `${name} directory exists`);
    return true;
  } else {
    log('red', '❌', `${name} directory missing: ${dirPath}`);
    return false;
  }
}

async function runDiagnostics() {
  console.log(`${colors.bold}${colors.blue}1. Checking Services...${colors.reset}`);
  const backendOK = await checkURL('http://localhost:4000/health', 'Backend (port 4000)');
  const frontendOK = await checkURL('http://localhost:3000', 'Frontend (port 3000)');
  
  console.log(`\n${colors.bold}${colors.blue}2. Checking Files and Directories...${colors.reset}`);
  
  const projectRoot = process.cwd();
  const testDir = path.join(projectRoot, 'test', 'e2e');
  
  // Check main structure
  checkDirectory(testDir, 'E2E test directory');
  checkDirectory(path.join(testDir, 'features'), 'Features directory');
  checkDirectory(path.join(testDir, 'step-definitions'), 'Step definitions directory');
  checkDirectory(path.join(testDir, 'support'), 'Support directory');
  
  // Check key files
  checkFile(path.join(testDir, 'tsconfig.json'), 'E2E TypeScript config');
  checkFile(path.join(testDir, 'support', 'world.ts'), 'World file');
  checkFile(path.join(testDir, 'support', 'hooks.ts'), 'Hooks file');
  checkFile(path.join(testDir, 'features', 'signup.feature'), 'Signup feature file');
  checkFile(path.join(testDir, 'step-definitions', 'signup.steps.ts'), 'Signup steps file');
  
  console.log(`\n${colors.bold}${colors.blue}3. Checking Dependencies...${colors.reset}`);
  
  // Check node_modules
  const nodeModules = path.join(projectRoot, 'node_modules');
  checkDirectory(path.join(nodeModules, '@playwright'), 'Playwright dependency');
  checkDirectory(path.join(nodeModules, '@cucumber'), 'Cucumber dependency');
  checkDirectory(path.join(nodeModules, 'playwright'), 'Playwright core');
  
  console.log(`\n${colors.bold}${colors.blue}4. Checking Package Scripts...${colors.reset}`);
  
  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    if (packageJson.scripts && packageJson.scripts['test:e2e:dev']) {
      log('green', '✅', 'test:e2e:dev script exists');
      console.log(`    Command: ${packageJson.scripts['test:e2e:dev']}`);
    } else {
      log('red', '❌', 'test:e2e:dev script missing');
    }
  }
  
  console.log(`\n${colors.bold}${colors.blue}5. Environment Information...${colors.reset}`);
  
  console.log(`Node version: ${process.version}`);
  console.log(`Platform: ${process.platform}`);
  console.log(`Working directory: ${process.cwd()}`);
  
  // Check environment variables
  const envVars = ['E2E_BASE_URL', 'E2E_BACKEND_URL', 'PLAYWRIGHT_HEADLESS'];
  envVars.forEach(envVar => {
    const value = process.env[envVar];
    if (value) {
      log('blue', 'ℹ️', `${envVar}=${value}`);
    } else {
      log('yellow', '⚠️', `${envVar} not set (will use default)`);
    }
  });
  
  console.log(`\n${colors.bold}${colors.blue}6. Summary & Recommendations...${colors.reset}`);
  
  if (!backendOK || !frontendOK) {
    log('yellow', '⚠️', 'Services not running. Start them first:');
    console.log('    Terminal 1: pnpm backend:dev');
    console.log('    Terminal 2: pnpm form-app:dev');
    console.log('    Terminal 3: pnpm test:e2e:dev');
  }
  
  if (backendOK && frontendOK) {
    log('green', '🎉', 'Services are running! You should be able to run: pnpm test:e2e:dev');
  }
  
  console.log('\nIf you\'re still having issues:');
  console.log('1. Check the full error message');
  console.log('2. Try: npx playwright install');
  console.log('3. Try: pnpm install');
  console.log('4. Try the full automated command: pnpm test:e2e');
  
  console.log(`\n${colors.bold}Diagnostic complete!${colors.reset}`);
}

runDiagnostics().catch(console.error);