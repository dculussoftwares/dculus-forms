/**
 * CommonJS wrapper for auth utilities to be used in integration tests
 */

const axios = require('axios');

// Base URL for API calls
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:4000';

// Simple utility functions that don't rely on ES modules
async function makeSignUpRequest(userData) {
  try {
    const response = await axios.post(`${BASE_URL}/api/sign-up`, userData);
    return {
      success: true,
      data: response.data,
      status: response.status
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      status: error.response?.status || 500
    };
  }
}

async function makeSignInRequest(userData) {
  try {
    const response = await axios.post(`${BASE_URL}/api/sign-in`, userData);
    return {
      success: true,
      data: response.data,
      status: response.status
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      status: error.response?.status || 500
    };
  }
}

async function checkHealthEndpoint() {
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

// Mock auth utilities that simulate the behavior
function validateEmail(email) {
  return /\S+@\S+\.\S+/.test(email);
}

function validatePassword(password) {
  return password && password.length >= 8;
}

function validateSignUpData(data) {
  const errors = [];
  
  if (!data.name?.trim()) {
    errors.push('Full name is required');
  }
  
  if (!data.email?.trim()) {
    errors.push('Email is required');
  } else if (!validateEmail(data.email)) {
    errors.push('Please enter a valid email');
  }
  
  if (!validatePassword(data.password)) {
    errors.push('Password must be at least 8 characters');
  }
  
  if (!data.organizationName?.trim()) {
    errors.push('Organization name is required');
  }
  
  return errors;
}

async function simulateSignUp(userData) {
  // Validate the data first
  const validationErrors = validateSignUpData(userData);
  
  if (validationErrors.length > 0) {
    return {
      success: false,
      error: validationErrors[0], // Return the first error
      status: 400
    };
  }
  
  // Simulate checking for existing user
  if (userData.email === 'existing@example.com' || createdUsers.has(userData.email)) {
    return {
      success: false,
      error: 'User already exists with this email',
      status: 409
    };
  }
  
  // Add the user to created users set
  createdUsers.add(userData.email);
  
  // Simulate successful creation
  return {
    success: true,
    data: {
      user: {
        id: 'mock-user-id',
        email: userData.email,
        name: userData.name,
        emailVerified: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      token: 'mock-auth-token-' + Date.now(),
      organizationId: 'mock-org-id'
    },
    status: 201
  };
}

async function simulateSignIn(userData) {
  // Basic validation
  if (!userData.email?.trim()) {
    return {
      success: false,
      error: 'Email is required',
      status: 400
    };
  }
  
  if (!userData.password) {
    return {
      success: false,
      error: 'Password is required',
      status: 400
    };
  }
  
  if (!validateEmail(userData.email)) {
    return {
      success: false,
      error: 'Please enter a valid email',
      status: 400
    };
  }
  
  // Simulate successful sign in for known test users
  if (userData.email.includes('test') || userData.email.includes('jane@example.com')) {
    return {
      success: true,
      data: {
        user: {
          id: 'mock-user-id',
          email: userData.email,
          name: 'Test User',
          emailVerified: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        token: 'mock-auth-token-' + Date.now(),
        organizationId: 'mock-org-id'
      },
      status: 200
    };
  }
  
  // Simulate invalid credentials
  return {
    success: false,
    error: 'Invalid credentials',
    status: 401
  };
}

// Store created users for cleanup simulation
const createdUsers = new Set();

async function simulateCleanup() {
  createdUsers.clear();
  return true;
}

module.exports = {
  makeSignUpRequest,
  makeSignInRequest,
  checkHealthEndpoint,
  simulateSignUp,
  simulateSignIn,
  simulateCleanup,
  validateSignUpData,
  createdUsers
};
