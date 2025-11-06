import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { responsesRouter } from '../responses.js';
import {
  getAllResponses,
  getResponseById,
  getResponsesByFormId,
  submitResponse,
  deleteResponse,
} from '../../services/responseService.js';
import { HTTP_STATUS } from '@dculus/utils';
import { errorHandler } from '../../middleware/errorHandler.js';

// Mock dependencies
vi.mock('../../services/responseService.js');

describe('Responses Routes', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/responses', responsesRouter);
    app.use(errorHandler); // Add error handler middleware
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockResponse = {
    id: 'response-123',
    formId: 'form-456',
    data: { field1: 'value1', field2: 'value2' },
    submittedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  describe('GET /', () => {
    it('should get all responses successfully', async () => {
      const mockResponses = [mockResponse, { ...mockResponse, id: 'response-456' }];
      vi.mocked(getAllResponses).mockResolvedValue(mockResponses as any);

      const response = await request(app).get('/api/responses');

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body).toEqual({
        success: true,
        data: mockResponses,
      });
      expect(getAllResponses).toHaveBeenCalledTimes(1);
    });

    it('should handle empty responses list', async () => {
      vi.mocked(getAllResponses).mockResolvedValue([]);

      const response = await request(app).get('/api/responses');

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body).toEqual({
        success: true,
        data: [],
      });
    });

    it('should handle database errors', async () => {
      vi.mocked(getAllResponses).mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/responses');

      expect(response.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /form/:formId', () => {
    it('should get responses by form ID successfully', async () => {
      const mockResponses = [mockResponse, { ...mockResponse, id: 'response-789' }];
      vi.mocked(getResponsesByFormId).mockResolvedValue(mockResponses as any);

      const response = await request(app).get('/api/responses/form/form-456');

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body).toEqual({
        success: true,
        data: mockResponses,
      });
      expect(getResponsesByFormId).toHaveBeenCalledWith('form-456');
    });

    it('should return empty array when no responses found for form', async () => {
      vi.mocked(getResponsesByFormId).mockResolvedValue([]);

      const response = await request(app).get('/api/responses/form/form-nonexistent');

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body).toEqual({
        success: true,
        data: [],
      });
    });

    it('should handle database errors when fetching by form ID', async () => {
      vi.mocked(getResponsesByFormId).mockRejectedValue(new Error('Database connection lost'));

      const response = await request(app).get('/api/responses/form/form-456');

      expect(response.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle special characters in form ID', async () => {
      vi.mocked(getResponsesByFormId).mockResolvedValue([mockResponse] as any);

      const specialFormId = 'form-123_abc-def';
      const response = await request(app).get(`/api/responses/form/${specialFormId}`);

      expect(getResponsesByFormId).toHaveBeenCalledWith(specialFormId);
    });
  });

  describe('GET /:id', () => {
    it('should get response by id successfully', async () => {
      vi.mocked(getResponseById).mockResolvedValue(mockResponse as any);

      const response = await request(app).get('/api/responses/response-123');

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body).toEqual({
        success: true,
        data: mockResponse,
      });
      expect(getResponseById).toHaveBeenCalledWith('response-123');
    });

    it('should return 404 when response not found', async () => {
      vi.mocked(getResponseById).mockResolvedValue(null);

      const response = await request(app).get('/api/responses/nonexistent-id');

      expect(response.status).toBe(HTTP_STATUS.NOT_FOUND);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle database errors when fetching response', async () => {
      vi.mocked(getResponseById).mockRejectedValue(new Error('Query timeout'));

      const response = await request(app).get('/api/responses/response-123');

      expect(response.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /', () => {
    const submitData = {
      formId: 'form-456',
      data: { field1: 'answer1', field2: 'answer2' },
    };

    it('should submit response successfully', async () => {
      const submittedResponse = { ...mockResponse, ...submitData };
      vi.mocked(submitResponse).mockResolvedValue(submittedResponse as any);

      const response = await request(app)
        .post('/api/responses')
        .send(submitData);

      expect(response.status).toBe(HTTP_STATUS.CREATED);
      expect(response.body).toEqual({
        success: true,
        data: submittedResponse,
      });
      expect(submitResponse).toHaveBeenCalledWith(submitData);
    });

    it('should handle validation errors during submission', async () => {
      vi.mocked(submitResponse).mockRejectedValue(new Error('Invalid data format'));

      const response = await request(app)
        .post('/api/responses')
        .send(submitData);

      expect(response.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(response.body).toHaveProperty('error');
    });

    it('should submit response with complex data structure', async () => {
      const complexData = {
        formId: 'form-456',
        data: {
          textField: 'Simple text',
          selectField: ['option1', 'option2'],
          nestedObject: { key: 'value' },
        },
      };

      vi.mocked(submitResponse).mockResolvedValue({ ...mockResponse, data: complexData.data } as any);

      const response = await request(app).post('/api/responses').send(complexData);

      expect(response.status).toBe(HTTP_STATUS.CREATED);
      expect(submitResponse).toHaveBeenCalledWith(complexData);
    });

    it('should handle empty data submission', async () => {
      const emptyData = { formId: 'form-456', data: {} };
      vi.mocked(submitResponse).mockResolvedValue({ ...mockResponse, data: {} } as any);

      const response = await request(app).post('/api/responses').send(emptyData);

      expect(response.status).toBe(HTTP_STATUS.CREATED);
    });

    it('should handle missing formId', async () => {
      vi.mocked(submitResponse).mockRejectedValue(new Error('formId is required'));

      const response = await request(app)
        .post('/api/responses')
        .send({ data: { field1: 'value1' } });

      expect(response.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
    });

    it('should handle plugin execution during submission', async () => {
      const dataWithMetadata = {
        ...submitData,
        metadata: { plugins: ['email', 'webhook'] },
      };

      vi.mocked(submitResponse).mockResolvedValue({
        ...mockResponse,
        metadata: { plugins: ['email', 'webhook'] },
      } as any);

      const response = await request(app).post('/api/responses').send(dataWithMetadata);

      expect(response.status).toBe(HTTP_STATUS.CREATED);
    });
  });

  describe('DELETE /:id', () => {
    it('should delete response successfully', async () => {
      vi.mocked(deleteResponse).mockResolvedValue(true);

      const response = await request(app).delete('/api/responses/response-123');

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body).toEqual({
        success: true,
        message: 'Response deleted successfully',
      });
      expect(deleteResponse).toHaveBeenCalledWith('response-123');
    });

    it('should return 404 when deleting nonexistent response', async () => {
      vi.mocked(deleteResponse).mockResolvedValue(false);

      const response = await request(app).delete('/api/responses/nonexistent-id');

      expect(response.status).toBe(HTTP_STATUS.NOT_FOUND);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle database errors during deletion', async () => {
      vi.mocked(deleteResponse).mockRejectedValue(new Error('Deletion failed'));

      const response = await request(app).delete('/api/responses/response-123');

      expect(response.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle permission errors during deletion', async () => {
      vi.mocked(deleteResponse).mockRejectedValue(new Error('Unauthorized'));

      const response = await request(app).delete('/api/responses/response-123');

      expect(response.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
    });
  });

  describe('Error handling', () => {
    it('should pass errors to next middleware', async () => {
      vi.mocked(getAllResponses).mockRejectedValue(new Error('Unexpected error'));

      const response = await request(app).get('/api/responses');

      expect(response.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
    });

    it('should handle network timeout errors', async () => {
      vi.mocked(getAllResponses).mockRejectedValue(new Error('ETIMEDOUT'));

      const response = await request(app).get('/api/responses');

      expect(response.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
    });
  });

  describe('Request validation', () => {
    it('should handle malformed JSON in POST', async () => {
      const response = await request(app)
        .post('/api/responses')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
    });

    it('should handle large request bodies', async () => {
      const largeData = {
        formId: 'form-456',
        data: {
          largeTextField: 'a'.repeat(10000),
        },
      };

      vi.mocked(submitResponse).mockResolvedValue({ ...mockResponse, data: largeData.data } as any);

      const response = await request(app).post('/api/responses').send(largeData);

      expect(response.status).toBe(HTTP_STATUS.CREATED);
    });
  });

  describe('Route parameters', () => {
    it('should handle UUID format IDs', async () => {
      const uuidId = '550e8400-e29b-41d4-a716-446655440000';
      vi.mocked(getResponseById).mockResolvedValue(mockResponse as any);

      const response = await request(app).get(`/api/responses/${uuidId}`);

      expect(getResponseById).toHaveBeenCalledWith(uuidId);
    });

    it('should handle URL encoded form IDs', async () => {
      vi.mocked(getResponsesByFormId).mockResolvedValue([mockResponse] as any);

      const encodedFormId = encodeURIComponent('form-123/special');
      const response = await request(app).get(`/api/responses/form/${encodedFormId}`);

      expect(response.status).toBe(HTTP_STATUS.OK);
    });
  });

  describe('Data integrity', () => {
    it('should preserve response data structure', async () => {
      const complexResponse = {
        ...mockResponse,
        data: {
          text: 'answer',
          number: 42,
          boolean: true,
          array: [1, 2, 3],
          object: { nested: 'value' },
        },
      };

      vi.mocked(getResponseById).mockResolvedValue(complexResponse as any);

      const response = await request(app).get('/api/responses/response-123');

      expect(response.body.data.data).toEqual(complexResponse.data);
    });

    it('should handle null values in response data', async () => {
      const responseWithNull = {
        ...mockResponse,
        data: { field1: null, field2: 'value' },
      };

      vi.mocked(getResponseById).mockResolvedValue(responseWithNull as any);

      const response = await request(app).get('/api/responses/response-123');

      expect(response.body.data.data.field1).toBeNull();
    });
  });
});
