const { World, setWorldConstructor } = require('@cucumber/cucumber');
const { testClient } = require('../utils/testClient');

class CustomWorld extends World {
  constructor(options: any) {
    super(options);
    this.testClient = testClient;
  }

  // Helper method to store response data
  setResponse(response: any) {
    this.response = response;
    this.responseBody = response.body;
    this.responseStatus = response.status;
    this.responseHeaders = response.headers;
  }

  // Helper method to get base URL
  getBaseUrl(): string {
    return this.parameters.baseUrl || 'http://localhost:4000';
  }

  // Helper method to log scenario info
  logScenario(message: string) {
    console.log(`[${this.scenarioName}] ${message}`);
  }
}

setWorldConstructor(CustomWorld);

module.exports = { CustomWorld };