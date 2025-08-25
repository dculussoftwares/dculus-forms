import { Router, Request, Response } from 'express';
import { getAllForms, getFormById, createForm, updateForm, deleteForm } from '../services/formService';
import { createError } from '../middleware/errorHandler';
import { HTTP_STATUS } from '@dculus/utils';

const router: Router = Router();

// Get all forms
router.get('/', async (req: Request, res: Response, next) => {
  try {
    const forms = await getAllForms();
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: forms,
    });
  } catch (error) {
    next(createError('Failed to fetch forms', HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
});

// Get form by ID
router.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;
    const form = await getFormById(id);
    
    if (!form) {
      return next(createError('Form not found', HTTP_STATUS.NOT_FOUND));
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: form,
    });
  } catch (error) {
    next(createError('Failed to fetch form', HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
});

// Create new form
router.post('/', async (req: Request, res: Response, next) => {
  try {
    const formData = req.body;
    const newForm = await createForm(formData);
    
    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: newForm,
    });
  } catch (error) {
    next(createError('Failed to create form', HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
});

// Update form
router.put('/:id', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;
    const formData = req.body;
    const updatedForm = await updateForm(id, formData);
    
    if (!updatedForm) {
      return next(createError('Form not found', HTTP_STATUS.NOT_FOUND));
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: updatedForm,
    });
  } catch (error) {
    next(createError('Failed to update form', HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
});

// Delete form
router.delete('/:id', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;
    const deleted = await deleteForm(id);
    
    if (!deleted) {
      return next(createError('Form not found', HTTP_STATUS.NOT_FOUND));
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Form deleted successfully',
    });
  } catch (error) {
    next(createError('Failed to delete form', HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
});

export { router as formsRouter }; 