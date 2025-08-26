const { Given, When, Then, DataTable } = require('@cucumber/cucumber');
const { CustomWorld } = require('../support/world');

// Use Node.js assert or implement basic expect
const expect = (actual: any) => ({
  toBe: (expected: any) => {
    if (actual !== expected) {
      throw new Error(`Expected ${actual} to be ${expected}`);
    }
  },
  toBeGreaterThan: (expected: any) => {
    if (actual <= expected) {
      throw new Error(`Expected ${actual} to be greater than ${expected}`);
    }
  },
  toBeGreaterThanOrEqual: (expected: any) => {
    if (actual < expected) {
      throw new Error(`Expected ${actual} to be greater than or equal to ${expected}`);
    }
  },
  toBeLessThan: (expected: any) => {
    if (actual >= expected) {
      throw new Error(`Expected ${actual} to be less than ${expected}`);
    }
  },
  toMatch: (pattern: RegExp) => {
    if (!pattern.test(actual)) {
      throw new Error(`Expected ${actual} to match ${pattern}`);
    }
  },
  toHaveProperty: (prop: string) => {
    if (!(prop in actual)) {
      throw new Error(`Expected ${JSON.stringify(actual)} to have property ${prop}`);
    }
  },
  toMatchObject: (expected: any) => {
    for (const key in expected) {
      if (typeof expected[key] === 'function') {
        if (!expected[key](actual[key])) {
          throw new Error(`Property ${key} did not match expected function`);
        }
      } else if (actual[key] !== expected[key]) {
        throw new Error(`Property ${key}: expected ${expected[key]}, got ${actual[key]}`);
      }
    }
  },
  not: {
    toBeNaN: () => {
      if (isNaN(actual)) {
        throw new Error(`Expected ${actual} not to be NaN`);
      }
    }
  }
});

// Store responses for multiple requests
let multipleResponses: any[] = [];
let requestStartTime: number;

Given('the backend service is running', async function(this: CustomWorld) {
  this.logScenario('Verifying backend service is running');
  
  // This is handled by the global BeforeAll hook, but we can add additional checks here
  await this.testClient.waitForReady();
  
  this.logScenario('Backend service is confirmed to be running');
});

When('I request the health check endpoint', async function(this: CustomWorld) {
  this.logScenario('Making health check request');
  
  requestStartTime = Date.now();
  const response = await this.testClient.healthCheck();
  this.setResponse(response);
  
  this.logScenario(`Health check completed with status ${response.status}`);
});

When('I make {int} consecutive health check requests', async function(this: CustomWorld, count: number) {
  this.logScenario(`Making ${count} consecutive health check requests`);
  
  multipleResponses = [];
  for (let i = 0; i < count; i++) {
    const response = await this.testClient.healthCheck();
    multipleResponses.push(response);
    this.logScenario(`Request ${i + 1}/${count} completed with status ${response.status}`);
  }
  
  // Set the last response as the current response
  this.setResponse(multipleResponses[multipleResponses.length - 1]);
});

Then('the response status should be {int}', function(this: CustomWorld, expectedStatus: number) {
  this.logScenario(`Verifying response status is ${expectedStatus}`);
  
  expect(this.responseStatus).toBe(expectedStatus);
});

Then('the response should be in JSON format', function(this: CustomWorld) {
  this.logScenario('Verifying response is in JSON format');
  
  expect(this.responseHeaders['content-type']).toMatch(/application\/json/);
});

Then('the response should contain success status', function(this: CustomWorld) {
  this.logScenario('Verifying response contains success status');
  
  expect(this.responseBody).toHaveProperty('success');
  expect(typeof this.responseBody.success).toBe('boolean');
});

Then('the success status should be {word}', function(this: CustomWorld, expectedValue: string) {
  const expected = expectedValue === 'true';
  this.logScenario(`Verifying success status is ${expected}`);
  
  expect(this.responseBody.success).toBe(expected);
});

Then('the response should contain the following fields:', function(this: CustomWorld, dataTable: DataTable) {
  this.logScenario('Verifying response structure');
  
  const expectedFields = dataTable.hashes();
  
  expectedFields.forEach(({ field, type }) => {
    expect(this.responseBody).toHaveProperty(field);
    
    const actualType = typeof this.responseBody[field];
    if (actualType !== type) {
      throw new Error(`Field '${field}' expected to be '${type}' but was '${actualType}'`);
    }
    
    this.logScenario(`Field '${field}' has correct type '${type}'`);
  });
});

Then('the response time should be less than {int} milliseconds', function(this: CustomWorld, maxTime: number) {
  const responseTime = Date.now() - requestStartTime;
  this.logScenario(`Verifying response time ${responseTime}ms is less than ${maxTime}ms`);
  
  expect(responseTime).toBeLessThan(maxTime);
});

Then('the timestamp should be a valid ISO date', function(this: CustomWorld) {
  this.logScenario('Verifying timestamp is a valid ISO date');
  
  const timestamp = new Date(this.responseBody.timestamp);
  expect(timestamp.getTime()).not.toBeNaN();
  expect(this.responseBody.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
});

Then('the timestamp should be recent', function(this: CustomWorld) {
  this.logScenario('Verifying timestamp is recent');
  
  const timestamp = new Date(this.responseBody.timestamp);
  const now = new Date();
  const differenceMs = now.getTime() - timestamp.getTime();
  
  // Should be within the last 5 minutes
  expect(differenceMs).toBeLessThan(5 * 60 * 1000);
});

Then('the uptime should be greater than {int}', function(this: CustomWorld, minUptime: number) {
  this.logScenario(`Verifying uptime ${this.responseBody.uptime} is greater than ${minUptime}`);
  
  expect(this.responseBody.uptime).toBeGreaterThan(minUptime);
});

Then('the uptime should be a number', function(this: CustomWorld) {
  this.logScenario('Verifying uptime is a number');
  
  expect(typeof this.responseBody.uptime).toBe('number');
});

Then('all responses should have status {int}', function(this: CustomWorld, expectedStatus: number) {
  this.logScenario(`Verifying all ${multipleResponses.length} responses have status ${expectedStatus}`);
  
  multipleResponses.forEach((response, index) => {
    expect(response.status).toBe(expectedStatus);
    this.logScenario(`Response ${index + 1} has correct status ${expectedStatus}`);
  });
});

Then('all responses should have success status {word}', function(this: CustomWorld, expectedValue: string) {
  const expected = expectedValue === 'true';
  this.logScenario(`Verifying all responses have success status ${expected}`);
  
  multipleResponses.forEach((response, index) => {
    expect(response.body.success).toBe(expected);
    this.logScenario(`Response ${index + 1} has correct success status ${expected}`);
  });
});

Then('each uptime should be greater than or equal to the previous uptime', function(this: CustomWorld) {
  this.logScenario('Verifying uptime values are monotonically increasing');
  
  for (let i = 1; i < multipleResponses.length; i++) {
    const currentUptime = multipleResponses[i].body.uptime;
    const previousUptime = multipleResponses[i - 1].body.uptime;
    
    expect(currentUptime).toBeGreaterThanOrEqual(previousUptime);
    this.logScenario(`Uptime ${i + 1} (${currentUptime}) >= uptime ${i} (${previousUptime})`);
  }
});