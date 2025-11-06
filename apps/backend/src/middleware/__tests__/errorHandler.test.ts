import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { errorHandler, createError, AppError } from '../errorHandler.js';
import { HTTP_STATUS } from '@dculus/utils';
import { logger } from '../../lib/logger.js';
import { appConfig } from '../../lib/env.js';

// Mock dependencies
vi.mock('../../lib/logger.js', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../lib/env.js', () => ({
  appConfig: {
    isDevelopment: false,
  },
}));

describe('errorHandler middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRequest = {
      url: '/api/test',
      method: 'GET',
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();

    // Reset config to production mode by default
    vi.mocked(appConfig).isDevelopment = false;
  });

  describe('errorHandler', () => {
    it('should handle basic error with default status code', () => {
      const error = new Error('Test error') as AppError;

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Test error',
      });
    });

    it('should handle error with custom status code', () => {
      const error = new Error('Not found') as AppError;
      error.statusCode = HTTP_STATUS.NOT_FOUND;

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Not found',
      });
    });

    it('should log error details', () => {
      const error = new Error('Test error') as AppError;
      error.statusCode = HTTP_STATUS.BAD_REQUEST;

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(logger.error).toHaveBeenCalledWith('Error:', {
        message: 'Test error',
        stack: expect.any(String),
        url: '/api/test',
        method: 'GET',
      });
    });

    it('should include stack trace in development mode', () => {
      vi.mocked(appConfig).isDevelopment = true;

      const error = new Error('Dev error') as AppError;
      error.statusCode = HTTP_STATUS.BAD_REQUEST;

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Dev error',
        stack: expect.any(String),
      });
    });

    it('should not include stack trace in production mode', () => {
      vi.mocked(appConfig).isDevelopment = false;

      const error = new Error('Prod error') as AppError;
      error.statusCode = HTTP_STATUS.BAD_REQUEST;

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Prod error',
      });
    });

    it('should handle error with missing message', () => {
      const error = new Error() as AppError;
      error.statusCode = HTTP_STATUS.BAD_REQUEST;

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal Server Error',
      });
    });

    it('should handle error without statusCode', () => {
      const error = new Error('Generic error') as AppError;

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR);
    });

    it('should handle 400 Bad Request error', () => {
      const error = new Error('Invalid input') as AppError;
      error.statusCode = HTTP_STATUS.BAD_REQUEST;

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid input',
      });
    });

    it('should handle 401 Unauthorized error', () => {
      const error = new Error('Unauthorized access') as AppError;
      error.statusCode = HTTP_STATUS.UNAUTHORIZED;

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.UNAUTHORIZED);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized access',
      });
    });

    it('should handle 403 Forbidden error', () => {
      const error = new Error('Forbidden') as AppError;
      error.statusCode = HTTP_STATUS.FORBIDDEN;

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Forbidden',
      });
    });

    it('should handle 404 Not Found error', () => {
      const error = new Error('Resource not found') as AppError;
      error.statusCode = HTTP_STATUS.NOT_FOUND;

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Resource not found',
      });
    });

    it('should handle 409 Conflict error', () => {
      const error = new Error('Resource conflict') as AppError;
      error.statusCode = 409;

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Resource conflict',
      });
    });

    it('should handle 422 Unprocessable Entity error', () => {
      const error = new Error('Validation failed') as AppError;
      error.statusCode = 422;

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed',
      });
    });

    it('should handle 500 Internal Server Error', () => {
      const error = new Error('Server error') as AppError;
      error.statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Server error',
      });
    });

    it('should log request URL and method', () => {
      mockRequest.url = '/api/users/123';
      mockRequest.method = 'POST';

      const error = new Error('Test error') as AppError;

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(logger.error).toHaveBeenCalledWith(
        'Error:',
        expect.objectContaining({
          url: '/api/users/123',
          method: 'POST',
        })
      );
    });

    it('should handle error with isOperational flag', () => {
      const error = new Error('Operational error') as AppError;
      error.statusCode = HTTP_STATUS.BAD_REQUEST;
      error.isOperational = true;

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Operational error',
      });
    });

    it('should return JSON response with success: false', () => {
      const error = new Error('Test error') as AppError;

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        })
      );
    });

    it('should handle error with stack trace in logs', () => {
      const error = new Error('Test error') as AppError;

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(logger.error).toHaveBeenCalledWith(
        'Error:',
        expect.objectContaining({
          stack: expect.stringContaining('Error: Test error'),
        })
      );
    });

    it('should chain response methods correctly', () => {
      const error = new Error('Test error') as AppError;

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalled();
      // Verify status was called before json due to chaining
      const statusCall = (mockResponse.status as any).mock.invocationCallOrder[0];
      const jsonCall = (mockResponse.json as any).mock.invocationCallOrder[0];
      expect(statusCall).toBeLessThan(jsonCall);
    });
  });

  describe('createError', () => {
    it('should create error with message and default status code', () => {
      const error = createError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
    });

    it('should create error with custom status code', () => {
      const error = createError('Not found', HTTP_STATUS.NOT_FOUND);

      expect(error.message).toBe('Not found');
      expect(error.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
      expect(error.isOperational).toBe(true);
    });

    it('should create error with 400 status code', () => {
      const error = createError('Bad request', HTTP_STATUS.BAD_REQUEST);

      expect(error.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
    });

    it('should create error with 401 status code', () => {
      const error = createError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);

      expect(error.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
    });

    it('should create error with 403 status code', () => {
      const error = createError('Forbidden', HTTP_STATUS.FORBIDDEN);

      expect(error.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
    });

    it('should create error with 404 status code', () => {
      const error = createError('Not found', HTTP_STATUS.NOT_FOUND);

      expect(error.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
    });

    it('should create error with 409 status code', () => {
      const error = createError('Conflict', 409);

      expect(error.statusCode).toBe(409);
    });

    it('should create error with 422 status code', () => {
      const error = createError('Unprocessable', 422);

      expect(error.statusCode).toBe(422);
    });

    it('should create error with 500 status code', () => {
      const error = createError('Server error', HTTP_STATUS.INTERNAL_SERVER_ERROR);

      expect(error.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
    });

    it('should always set isOperational to true', () => {
      const error1 = createError('Error 1');
      const error2 = createError('Error 2', HTTP_STATUS.BAD_REQUEST);
      const error3 = createError('Error 3', HTTP_STATUS.NOT_FOUND);

      expect(error1.isOperational).toBe(true);
      expect(error2.isOperational).toBe(true);
      expect(error3.isOperational).toBe(true);
    });

    it('should create error with empty message', () => {
      const error = createError('');

      expect(error.message).toBe('');
      expect(error.statusCode).toBe(500);
    });

    it('should create error with long message', () => {
      const longMessage = 'A'.repeat(1000);
      const error = createError(longMessage, HTTP_STATUS.BAD_REQUEST);

      expect(error.message).toBe(longMessage);
      expect(error.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
    });

    it('should create error with special characters in message', () => {
      const message = 'Error: <test> "quotes" & symbols!';
      const error = createError(message, HTTP_STATUS.BAD_REQUEST);

      expect(error.message).toBe(message);
    });

    it('should create error that can be caught and re-thrown', () => {
      const error = createError('Test error', HTTP_STATUS.BAD_REQUEST);

      expect(() => {
        throw error;
      }).toThrow('Test error');
    });

    it('should create error with stack trace', () => {
      const error = createError('Test error', HTTP_STATUS.BAD_REQUEST);

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('Test error');
    });

    it('should create multiple independent errors', () => {
      const error1 = createError('Error 1', 400);
      const error2 = createError('Error 2', 404);
      const error3 = createError('Error 3', 500);

      expect(error1.message).toBe('Error 1');
      expect(error1.statusCode).toBe(400);

      expect(error2.message).toBe('Error 2');
      expect(error2.statusCode).toBe(404);

      expect(error3.message).toBe('Error 3');
      expect(error3.statusCode).toBe(500);
    });

    it('should create error compatible with errorHandler', () => {
      const error = createError('Test error', HTTP_STATUS.BAD_REQUEST);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Test error',
      });
    });
  });

  describe('AppError interface', () => {
    it('should support statusCode property', () => {
      const error = new Error('Test') as AppError;
      error.statusCode = HTTP_STATUS.BAD_REQUEST;

      expect(error.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
    });

    it('should support isOperational property', () => {
      const error = new Error('Test') as AppError;
      error.isOperational = true;

      expect(error.isOperational).toBe(true);
    });

    it('should support optional properties', () => {
      const error = new Error('Test') as AppError;

      expect(error.statusCode).toBeUndefined();
      expect(error.isOperational).toBeUndefined();
    });
  });

  describe('integration scenarios', () => {
    it('should handle full error lifecycle', () => {
      const error = createError('Validation failed', 422);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(logger.error).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed',
      });
    });

    it('should handle authentication error flow', () => {
      const error = createError('Invalid token', HTTP_STATUS.UNAUTHORIZED);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.UNAUTHORIZED);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid token',
      });
    });

    it('should handle authorization error flow', () => {
      const error = createError('Insufficient permissions', HTTP_STATUS.FORBIDDEN);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Insufficient permissions',
      });
    });

    it('should handle resource not found flow', () => {
      const error = createError('User not found', HTTP_STATUS.NOT_FOUND);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'User not found',
      });
    });
  });
});
