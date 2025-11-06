import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { formsRouter } from '../forms.js';
import {
  getAllForms,
  getFormById,
  createForm,
  updateForm,
  deleteForm,
} from '../../services/formService.js';
import { HTTP_STATUS } from '@dculus/utils';
import { errorHandler } from '../../middleware/errorHandler.js';

// Mock dependencies
vi.mock('../../services/formService.js');

describe('Forms Routes', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/forms', formsRouter);
    app.use(errorHandler); // Add error handler middleware
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockForm = {
    id: 'form-123',
    title: 'Test Form',
    description: 'Test Description',
    organizationId: 'org-456',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  describe('GET /', () => {
    it('should get all forms successfully', async () => {
      const mockForms = [mockForm, { ...mockForm, id: 'form-456' }];
      vi.mocked(getAllForms).mockResolvedValue(mockForms as any);

      const response = await request(app).get('/api/forms');

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body).toEqual({
        success: true,
        data: mockForms,
      });
      expect(getAllForms).toHaveBeenCalledTimes(1);
    });

    it('should handle empty forms list', async () => {
      vi.mocked(getAllForms).mockResolvedValue([]);

      const response = await request(app).get('/api/forms');

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body).toEqual({
        success: true,
        data: [],
      });
    });

    it('should handle database errors', async () => {
      vi.mocked(getAllForms).mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/forms');

      expect(response.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /:id', () => {
    it('should get form by id successfully', async () => {
      vi.mocked(getFormById).mockResolvedValue(mockForm as any);

      const response = await request(app).get('/api/forms/form-123');

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body).toEqual({
        success: true,
        data: mockForm,
      });
      expect(getFormById).toHaveBeenCalledWith('form-123');
    });

    it('should return 404 when form not found', async () => {
      vi.mocked(getFormById).mockResolvedValue(null);

      const response = await request(app).get('/api/forms/nonexistent-id');

      expect(response.status).toBe(HTTP_STATUS.NOT_FOUND);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle database errors when fetching form', async () => {
      vi.mocked(getFormById).mockRejectedValue(new Error('Database connection lost'));

      const response = await request(app).get('/api/forms/form-123');

      expect(response.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /', () => {
    const createFormData = {
      title: 'New Form',
      description: 'New Description',
      organizationId: 'org-456',
    };

    it('should create form successfully', async () => {
      const createdForm = { ...mockForm, ...createFormData };
      vi.mocked(createForm).mockResolvedValue(createdForm as any);

      const response = await request(app)
        .post('/api/forms')
        .send(createFormData);

      expect(response.status).toBe(HTTP_STATUS.CREATED);
      expect(response.body).toEqual({
        success: true,
        data: createdForm,
      });
      expect(createForm).toHaveBeenCalledWith(createFormData);
    });

    it('should handle validation errors', async () => {
      vi.mocked(createForm).mockRejectedValue(new Error('Validation failed'));

      const response = await request(app)
        .post('/api/forms')
        .send(createFormData);

      expect(response.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(response.body).toHaveProperty('error');
    });

    it('should create form with minimal data', async () => {
      const minimalData = { title: 'Minimal Form' };
      vi.mocked(createForm).mockResolvedValue({ ...mockForm, title: 'Minimal Form' } as any);

      const response = await request(app).post('/api/forms').send(minimalData);

      expect(response.status).toBe(HTTP_STATUS.CREATED);
      expect(createForm).toHaveBeenCalledWith(minimalData);
    });

    it('should handle empty request body', async () => {
      vi.mocked(createForm).mockRejectedValue(new Error('Title is required'));

      const response = await request(app).post('/api/forms').send({});

      expect(response.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /:id', () => {
    const updateData = {
      title: 'Updated Form',
      description: 'Updated Description',
    };

    it('should update form successfully', async () => {
      const updatedForm = { ...mockForm, ...updateData };
      vi.mocked(updateForm).mockResolvedValue(updatedForm as any);

      const response = await request(app)
        .put('/api/forms/form-123')
        .send(updateData);

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body).toEqual({
        success: true,
        data: updatedForm,
      });
      expect(updateForm).toHaveBeenCalledWith('form-123', updateData);
    });

    it('should return 404 when updating nonexistent form', async () => {
      vi.mocked(updateForm).mockResolvedValue(null);

      const response = await request(app)
        .put('/api/forms/nonexistent-id')
        .send(updateData);

      expect(response.status).toBe(HTTP_STATUS.NOT_FOUND);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle partial updates', async () => {
      const partialUpdate = { title: 'Only Title Updated' };
      const updatedForm = { ...mockForm, title: 'Only Title Updated' };
      vi.mocked(updateForm).mockResolvedValue(updatedForm as any);

      const response = await request(app)
        .put('/api/forms/form-123')
        .send(partialUpdate);

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(updateForm).toHaveBeenCalledWith('form-123', partialUpdate);
    });

    it('should handle database errors during update', async () => {
      vi.mocked(updateForm).mockRejectedValue(new Error('Update failed'));

      const response = await request(app)
        .put('/api/forms/form-123')
        .send(updateData);

      expect(response.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle empty update data', async () => {
      vi.mocked(updateForm).mockResolvedValue(mockForm as any);

      const response = await request(app).put('/api/forms/form-123').send({});

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(updateForm).toHaveBeenCalledWith('form-123', {});
    });
  });

  describe('DELETE /:id', () => {
    it('should delete form successfully', async () => {
      vi.mocked(deleteForm).mockResolvedValue(true);

      const response = await request(app).delete('/api/forms/form-123');

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body).toEqual({
        success: true,
        message: 'Form deleted successfully',
      });
      expect(deleteForm).toHaveBeenCalledWith('form-123');
    });

    it('should return 404 when deleting nonexistent form', async () => {
      vi.mocked(deleteForm).mockResolvedValue(false);

      const response = await request(app).delete('/api/forms/nonexistent-id');

      expect(response.status).toBe(HTTP_STATUS.NOT_FOUND);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle database errors during deletion', async () => {
      vi.mocked(deleteForm).mockRejectedValue(new Error('Deletion failed'));

      const response = await request(app).delete('/api/forms/form-123');

      expect(response.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle cascading deletion errors', async () => {
      vi.mocked(deleteForm).mockRejectedValue(
        new Error('Cannot delete form with existing responses')
      );

      const response = await request(app).delete('/api/forms/form-123');

      expect(response.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Error handling', () => {
    it('should pass errors to next middleware', async () => {
      vi.mocked(getAllForms).mockRejectedValue(new Error('Unexpected error'));

      const response = await request(app).get('/api/forms');

      expect(response.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
    });

    it('should handle timeout errors', async () => {
      vi.mocked(getAllForms).mockRejectedValue(new Error('Request timeout'));

      const response = await request(app).get('/api/forms');

      expect(response.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
    });
  });

  describe('Request validation', () => {
    it('should handle malformed JSON in POST', async () => {
      const response = await request(app)
        .post('/api/forms')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
    });

    it('should handle malformed JSON in PUT', async () => {
      const response = await request(app)
        .put('/api/forms/form-123')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
    });
  });

  describe('Route parameters', () => {
    it('should handle special characters in form ID', async () => {
      vi.mocked(getFormById).mockResolvedValue(mockForm as any);

      const specialId = 'form-123-abc_def';
      const response = await request(app).get(`/api/forms/${specialId}`);

      expect(getFormById).toHaveBeenCalledWith(specialId);
    });

    it('should handle UUID format IDs', async () => {
      const uuidId = '550e8400-e29b-41d4-a716-446655440000';
      vi.mocked(getFormById).mockResolvedValue(mockForm as any);

      const response = await request(app).get(`/api/forms/${uuidId}`);

      expect(getFormById).toHaveBeenCalledWith(uuidId);
    });
  });
});
