import { Router, Request, Response, NextFunction } from 'express';
import {
  getAllTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getTemplatesByCategory,
  getTemplateCategories,
} from '../services/templateService';

const router: Router = Router();

/**
 * GET /api/templates
 * Get all templates, optionally filter by category
 */
router.get('/', async (req, res, next) => {
  try {
    const category = req.query.category as string | undefined;
    const templates = await getAllTemplates(category);
    res.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/templates/categories
 * Get all template categories
 */
router.get('/categories', async (req, res, next) => {
  try {
    const categories = await getTemplateCategories();
    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/templates/by-category
 * Get templates grouped by category
 */
router.get('/by-category', async (req, res, next) => {
  try {
    const templatesByCategory = await getTemplatesByCategory();
    res.json({
      success: true,
      data: templatesByCategory,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/templates/:id
 * Get a template by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const template = await getTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      });
    }
    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/templates
 * Create a new template
 */
router.post('/', async (req, res, next) => {
  try {
    const { name, description, category, formSchema } = req.body;
    
    if (!name || !formSchema) {
      return res.status(400).json({
        success: false,
        error: 'Name and formSchema are required',
      });
    }

    const template = await createTemplate({
      name,
      description,
      category,
      formSchema,
    });

    res.status(201).json({
      success: true,
      data: template,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/templates/:id
 * Update a template
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { name, description, category, formSchema, isActive } = req.body;
    
    const template = await updateTemplate(req.params.id, {
      name,
      description,
      category,
      formSchema,
      isActive,
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      });
    }

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/templates/:id
 * Delete a template (soft delete)
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const success = await deleteTemplate(req.params.id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      });
    }

    res.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
