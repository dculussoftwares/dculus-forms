/** @type {import('@cucumber/cucumber').IConfiguration} */
module.exports = {
  default: {
    // Feature files location
    paths: ['tests/integration/features/**/*.feature'],
    
    // Support TypeScript - using require with ts-node
    requireModule: ['ts-node/register'],
    
    // Step definitions, hooks, and world
    require: [
      'tests/integration/steps/**/*.js',
      'tests/integration/support/world.js',
      'tests/integration/setup/cucumber-setup.js'
    ],
    
    // Output formatters
    format: [
      'progress-bar',
      '@cucumber/pretty-formatter',
      'html:tests/integration/reports/cucumber-report.html',
      'json:tests/integration/reports/cucumber-report.json'
    ],
    
    // Fail fast on first failure
    failFast: false,
    
    // Retry failed scenarios
    retry: 1,
    
    // Parallel execution
    parallel: 1,
    
    // Timeout for steps (30 seconds)
    timeout: 30000,
    
    // World parameters
    worldParameters: {
      baseUrl: process.env.TEST_BASE_URL || 'http://localhost:4000',
    },
    
    // Tag expressions
    tags: 'not @skip',
  },
  
  // Profile for CI/CD
  ci: {
    paths: ['tests/integration/features/**/*.feature'],
    requireModule: ['ts-node/register'],
    require: [
      'tests/integration/steps/**/*.js',
      'tests/integration/support/world.js', 
      'tests/integration/setup/cucumber-setup.js'
    ],
    format: [
      'progress-bar',
      'json:tests/integration/reports/cucumber-report.json'
    ],
    failFast: true,
    retry: 0,
    parallel: 1,
    timeout: 30000,
    worldParameters: {
      baseUrl: process.env.TEST_BASE_URL || 'http://localhost:4000',
    },
    tags: 'not @skip and not @manual',
  }
};