const { BeforeAll, AfterAll, Before, After, setDefaultTimeout } = require('@cucumber/cucumber');
const { testClient } = require('../utils/testClient');

// Set default timeout for all steps
setDefaultTimeout(30000);

// Global setup - runs once before all scenarios
BeforeAll(async function() {
  console.log('🥒 Starting Cucumber integration tests...');
  
  // Wait for the backend service to be ready
  await testClient.waitForReady();
  
  console.log('✅ Test environment is ready');
});

// Global teardown - runs once after all scenarios
AfterAll(async function() {
  console.log('🥒 Cucumber integration tests completed');
});

// Scenario setup - runs before each scenario
Before(async function(scenario) {
  console.log(`\n🎬 Starting scenario: ${scenario.pickle.name}`);
  
  // Attach scenario info to the world context
  this.scenarioName = scenario.pickle.name;
  this.scenarioTags = scenario.pickle.tags.map(tag => tag.name);
  
  // Initialize test client for this scenario
  this.testClient = testClient;
  
  // Clear authentication state before each scenario
  if (this.scenarioTags.includes('@auth')) {
    this.testClient.clearAuthTokens();
    console.log('🔐 Authentication state cleared for auth scenario');
  }
});

// Scenario teardown - runs after each scenario
After(async function(scenario) {
  if (scenario.result?.status === 'FAILED') {
    console.log(`❌ Scenario failed: ${scenario.pickle.name}`);
    
    // Add screenshot or logs if needed
    // this.attach(screenshot, 'image/png');
  } else {
    console.log(`✅ Scenario passed: ${scenario.pickle.name}`);
  }
});