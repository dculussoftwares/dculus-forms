import dotenv from 'dotenv';
import path from 'path';

// Load integration test environment variables
dotenv.config({ path: path.join(__dirname, '../..', '.env.integration') });

// Set test timeout globally
jest.setTimeout(30000);