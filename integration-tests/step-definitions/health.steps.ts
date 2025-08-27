import { When, Then } from '@cucumber/cucumber';
import axios from 'axios';
import { CustomWorld } from '../support/world';

// Simple assertion function
const expect = (actual: any) => ({
  toBe: (expected: any) => {
    if (actual !== expected) {
      throw new Error(`Expected ${actual} to be ${expected}`);
    }
  },
  toHaveProperty: (property: string) => {
    if (!(property in actual)) {
      throw new Error(`Expected object to have property '${property}'`);
    }
  },
  toBeDefined: () => {
    if (actual === undefined) {
      throw new Error('Expected value to be defined');
    }
  },
  toMatch: (pattern: RegExp) => {
    if (!pattern.test(actual)) {
      throw new Error(`Expected ${actual} to match ${pattern}`);
    }
  }
});

When('I send a GET request to {string}', async function (this: CustomWorld, endpoint: string) {
  try {
    this.response = await axios.get(`${this.baseURL}${endpoint}`);
  } catch (error: any) {
    // Store error response for validation
    this.response = error.response;
  }
});

Then('the response status code should be {int}', function (this: CustomWorld, expectedStatusCode: number) {
  expect(this.response?.status).toBe(expectedStatusCode);
});

Then('the response should contain {string} field with value true', function (this: CustomWorld, fieldName: string) {
  expect(this.response?.data).toHaveProperty(fieldName);
  expect(this.response?.data[fieldName]).toBe(true);
});

Then('the response should contain {string} field with value false', function (this: CustomWorld, fieldName: string) {
  expect(this.response?.data).toHaveProperty(fieldName);
  expect(this.response?.data[fieldName]).toBe(false);
});

Then('the response should contain {string} field with value {string}', function (this: CustomWorld, fieldName: string, expectedValue: string) {
  expect(this.response?.data).toHaveProperty(fieldName);
  expect(this.response?.data[fieldName]).toBe(expectedValue);
});

Then('the response should contain {string} field', function (this: CustomWorld, fieldName: string) {
  expect(this.response?.data).toHaveProperty(fieldName);
  expect(this.response?.data[fieldName]).toBeDefined();
});

Then('the response should be valid JSON', function (this: CustomWorld) {
  expect(this.response?.data).toBeDefined();
  expect(typeof this.response?.data).toBe('object');
});

Then('the response should have the correct content type', function (this: CustomWorld) {
  const contentType = this.response?.headers['content-type'];
  expect(contentType).toMatch(/application\/json/);
});