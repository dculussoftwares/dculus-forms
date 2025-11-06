import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import templateRouter from '../templates.js';
import {
  getAllTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getTemplatesByCategory,
  getTemplateCategories,
} from '../../services/templateService.js';
import { errorHandler } from '../../middleware/errorHandler.js';

// Mock dependencies
vi.mock('../../services/templateService.js');

describe('Templates Routes', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/templates', templateRouter);
    app.use(errorHandler); // Add error handler middleware
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockTemplate = {
    id: 'template-123',
    name: 'Contact Form',
    description: 'Basic contact form template',
    category: 'Contact',
    formSchema: { pages: [], layout: {} },
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  describe('GET /', () => {
    it('should get all templates successfully', async () => {
      const mockTemplates = [mockTemplate, { ...mockTemplate, id: 'template-456' }];
      vi.mocked(getAllTemplates).mockResolvedValue(mockTemplates as any);

      const response = await request(app).get('/api/templates');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockTemplates,
      });
      expect(getAllTemplates).toHaveBeenCalledWith(undefined);
    });

    it('should filter templates by category', async () => {
      const contactTemplates = [mockTemplate];
      vi.mocked(getAllTemplates).mockResolvedValue(contactTemplates as any);

      const response = await request(app).get('/api/templates?category=Contact');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: contactTemplates,
      });
      expect(getAllTemplates).toHaveBeenCalledWith('Contact');
    });

    it('should handle empty templates list', async () => {
      vi.mocked(getAllTemplates).mockResolvedValue([]);

      const response = await request(app).get('/api/templates');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: [],
      });
    });

    it('should handle database errors', async () => {
      vi.mocked(getAllTemplates).mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/templates');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /categories', () => {
    it('should get all template categories successfully', async () => {
      const mockCategories = ['Contact', 'Survey', 'Registration', 'Feedback'];
      vi.mocked(getTemplateCategories).mockResolvedValue(mockCategories);

      const response = await request(app).get('/api/templates/categories');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockCategories,
      });
      expect(getTemplateCategories).toHaveBeenCalledTimes(1);
    });

    it('should handle empty categories list', async () => {
      vi.mocked(getTemplateCategories).mockResolvedValue([]);

      const response = await request(app).get('/api/templates/categories');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: [],
      });
    });

    it('should handle database errors when fetching categories', async () => {
      vi.mocked(getTemplateCategories).mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app).get('/api/templates/categories');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /by-category', () => {
    it('should get templates grouped by category', async () => {
      const mockGroupedTemplates = {
        Contact: [mockTemplate],
        Survey: [{ ...mockTemplate, id: 'template-789', category: 'Survey' }],
      };
      vi.mocked(getTemplatesByCategory).mockResolvedValue(mockGroupedTemplates as any);

      const response = await request(app).get('/api/templates/by-category');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Object.keys(response.body.data)).toEqual(['Contact', 'Survey']);
      expect(getTemplatesByCategory).toHaveBeenCalledTimes(1);
    });

    it('should handle empty grouped templates', async () => {
      vi.mocked(getTemplatesByCategory).mockResolvedValue({});

      const response = await request(app).get('/api/templates/by-category');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {},
      });
    });

    it('should handle database errors when grouping', async () => {
      vi.mocked(getTemplatesByCategory).mockRejectedValue(new Error('Aggregation failed'));

      const response = await request(app).get('/api/templates/by-category');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /:id', () => {
    it('should get template by id successfully', async () => {
      vi.mocked(getTemplateById).mockResolvedValue(mockTemplate as any);

      const response = await request(app).get('/api/templates/template-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(mockTemplate.id);
      expect(response.body.data.name).toBe(mockTemplate.name);
      expect(getTemplateById).toHaveBeenCalledWith('template-123');
    });

    it('should return 404 when template not found', async () => {
      vi.mocked(getTemplateById).mockResolvedValue(null);

      const response = await request(app).get('/api/templates/nonexistent-id');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: 'Template not found',
      });
    });

    it('should handle database errors when fetching template', async () => {
      vi.mocked(getTemplateById).mockRejectedValue(new Error('Query timeout'));

      const response = await request(app).get('/api/templates/template-123');

      expect(response.status).toBe(500);
    });
  });

  describe('POST /', () => {
    const createTemplateData = {
      name: 'New Template',
      description: 'A new template',
      category: 'Survey',
      formSchema: { pages: [], layout: {} },
    };

    it('should create template successfully', async () => {
      const createdTemplate = { ...mockTemplate, ...createTemplateData };
      vi.mocked(createTemplate).mockResolvedValue(createdTemplate as any);

      const response = await request(app)
        .post('/api/templates')
        .send(createTemplateData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(createTemplateData.name);
      expect(response.body.data.category).toBe(createTemplateData.category);
      expect(createTemplate).toHaveBeenCalledWith(createTemplateData);
    });

    it('should return 400 when name is missing', async () => {
      const invalidData = {
        description: 'Missing name',
        formSchema: { pages: [] },
      };

      const response = await request(app).post('/api/templates').send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Name and formSchema are required',
      });
      expect(createTemplate).not.toHaveBeenCalled();
    });

    it('should return 400 when formSchema is missing', async () => {
      const invalidData = {
        name: 'Template without schema',
        description: 'Missing formSchema',
      };

      const response = await request(app).post('/api/templates').send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Name and formSchema are required',
      });
      expect(createTemplate).not.toHaveBeenCalled();
    });

    it('should create template without optional fields', async () => {
      const minimalData = {
        name: 'Minimal Template',
        formSchema: { pages: [] },
      };

      vi.mocked(createTemplate).mockResolvedValue({
        ...mockTemplate,
        name: 'Minimal Template',
        description: null,
        category: null,
      } as any);

      const response = await request(app).post('/api/templates').send(minimalData);

      expect(response.status).toBe(201);
      expect(createTemplate).toHaveBeenCalledWith({
        name: 'Minimal Template',
        description: undefined,
        category: undefined,
        formSchema: { pages: [] },
      });
    });

    it('should handle validation errors', async () => {
      vi.mocked(createTemplate).mockRejectedValue(new Error('Invalid schema format'));

      const response = await request(app)
        .post('/api/templates')
        .send(createTemplateData);

      expect(response.status).toBe(500);
    });
  });

  describe('PUT /:id', () => {
    const updateData = {
      name: 'Updated Template',
      description: 'Updated description',
      category: 'Feedback',
      formSchema: { pages: [], layout: { theme: 'dark' } },
      isActive: false,
    };

    it('should update template successfully', async () => {
      const updatedTemplate = { ...mockTemplate, ...updateData };
      vi.mocked(updateTemplate).mockResolvedValue(updatedTemplate as any);

      const response = await request(app)
        .put('/api/templates/template-123')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.isActive).toBe(updateData.isActive);
      expect(updateTemplate).toHaveBeenCalledWith('template-123', updateData);
    });

    it('should return 404 when updating nonexistent template', async () => {
      vi.mocked(updateTemplate).mockResolvedValue(null);

      const response = await request(app)
        .put('/api/templates/nonexistent-id')
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: 'Template not found',
      });
    });

    it('should handle partial updates', async () => {
      const partialUpdate = { name: 'Only Name Updated' };
      const updatedTemplate = { ...mockTemplate, name: 'Only Name Updated' };
      vi.mocked(updateTemplate).mockResolvedValue(updatedTemplate as any);

      const response = await request(app)
        .put('/api/templates/template-123')
        .send(partialUpdate);

      expect(response.status).toBe(200);
      expect(updateTemplate).toHaveBeenCalledWith('template-123', {
        name: 'Only Name Updated',
        description: undefined,
        category: undefined,
        formSchema: undefined,
        isActive: undefined,
      });
    });

    it('should update isActive status', async () => {
      const statusUpdate = { isActive: false };
      vi.mocked(updateTemplate).mockResolvedValue({ ...mockTemplate, isActive: false } as any);

      const response = await request(app)
        .put('/api/templates/template-123')
        .send(statusUpdate);

      expect(response.status).toBe(200);
      expect(updateTemplate).toHaveBeenCalledWith('template-123', expect.objectContaining({
        isActive: false,
      }));
    });

    it('should handle database errors during update', async () => {
      vi.mocked(updateTemplate).mockRejectedValue(new Error('Update failed'));

      const response = await request(app)
        .put('/api/templates/template-123')
        .send(updateData);

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /:id', () => {
    it('should delete template successfully', async () => {
      vi.mocked(deleteTemplate).mockResolvedValue(true);

      const response = await request(app).delete('/api/templates/template-123');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Template deleted successfully',
      });
      expect(deleteTemplate).toHaveBeenCalledWith('template-123');
    });

    it('should return 404 when deleting nonexistent template', async () => {
      vi.mocked(deleteTemplate).mockResolvedValue(false);

      const response = await request(app).delete('/api/templates/nonexistent-id');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: 'Template not found',
      });
    });

    it('should handle database errors during deletion', async () => {
      vi.mocked(deleteTemplate).mockRejectedValue(new Error('Deletion failed'));

      const response = await request(app).delete('/api/templates/template-123');

      expect(response.status).toBe(500);
    });
  });

  describe('Request validation', () => {
    it('should handle malformed JSON in POST', async () => {
      const response = await request(app)
        .post('/api/templates')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
    });

    it('should handle malformed JSON in PUT', async () => {
      const response = await request(app)
        .put('/api/templates/template-123')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
    });
  });

  describe('Route parameters', () => {
    it('should handle UUID format IDs', async () => {
      const uuidId = '550e8400-e29b-41d4-a716-446655440000';
      vi.mocked(getTemplateById).mockResolvedValue(mockTemplate as any);

      const response = await request(app).get(`/api/templates/${uuidId}`);

      expect(getTemplateById).toHaveBeenCalledWith(uuidId);
    });

    it('should handle special characters in template ID', async () => {
      vi.mocked(getTemplateById).mockResolvedValue(mockTemplate as any);

      const specialId = 'template-123_abc-def';
      const response = await request(app).get(`/api/templates/${specialId}`);

      expect(getTemplateById).toHaveBeenCalledWith(specialId);
    });

    it('should handle URL encoded category names', async () => {
      vi.mocked(getAllTemplates).mockResolvedValue([mockTemplate] as any);

      const encodedCategory = encodeURIComponent('Contact & Support');
      const response = await request(app).get(`/api/templates?category=${encodedCategory}`);

      expect(getAllTemplates).toHaveBeenCalledWith('Contact & Support');
    });
  });

  describe('Complex formSchema handling', () => {
    it('should create template with complex formSchema', async () => {
      const complexSchema = {
        pages: [
          {
            id: 'page-1',
            title: 'Page 1',
            fields: [
              { id: 'field-1', type: 'text', label: 'Name' },
              { id: 'field-2', type: 'email', label: 'Email' },
            ],
          },
        ],
        layout: {
          theme: 'light',
          spacing: 'normal',
          textColor: '#000000',
        },
      };

      const templateData = {
        name: 'Complex Template',
        formSchema: complexSchema,
      };

      vi.mocked(createTemplate).mockResolvedValue({
        ...mockTemplate,
        formSchema: complexSchema,
      } as any);

      const response = await request(app).post('/api/templates').send(templateData);

      expect(response.status).toBe(201);
      expect(response.body.data.formSchema).toEqual(complexSchema);
    });

    it('should preserve formSchema structure during update', async () => {
      const updatedSchema = {
        pages: [
          {
            id: 'page-1',
            title: 'Updated Page',
            fields: [{ id: 'field-1', type: 'select', options: ['A', 'B', 'C'] }],
          },
        ],
      };

      vi.mocked(updateTemplate).mockResolvedValue({
        ...mockTemplate,
        formSchema: updatedSchema,
      } as any);

      const response = await request(app)
        .put('/api/templates/template-123')
        .send({ formSchema: updatedSchema });

      expect(response.status).toBe(200);
      expect(response.body.data.formSchema).toEqual(updatedSchema);
    });
  });

  describe('Error propagation', () => {
    it('should propagate errors to error handler middleware', async () => {
      vi.mocked(getAllTemplates).mockRejectedValue(new Error('Critical error'));

      const response = await request(app).get('/api/templates');

      expect(response.status).toBe(500);
    });
  });
});
