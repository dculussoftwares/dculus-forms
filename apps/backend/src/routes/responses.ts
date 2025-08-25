import { Router, Request, Response, NextFunction } from 'express';
import { getAllResponses, getResponseById, getResponsesByFormId, submitResponse, deleteResponse } from '../services/responseService.js';
import { createError } from '../middleware/errorHandler.js';
import { HTTP_STATUS } from '@dculus/utils';

const router: Router = Router();

// Get all responses
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const responses = await getAllResponses();
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: responses,
    });
  } catch (error) {
    next(createError('Failed to fetch responses', HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
});

// Get responses by form ID
router.get('/form/:formId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { formId } = req.params;
    const responses = await getResponsesByFormId(formId);
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: responses,
    });
  } catch (error) {
    next(createError('Failed to fetch responses', HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
});

// Get response by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const response = await getResponseById(id);
    
    if (!response) {
      return next(createError('Response not found', HTTP_STATUS.NOT_FOUND));
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: response,
    });
  } catch (error) {
    next(createError('Failed to fetch response', HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
});

// Submit new response
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const responseData = req.body;
    const newResponse = await submitResponse(responseData);
    
    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: newResponse,
    });
  } catch (error) {
    next(createError('Failed to submit response', HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
});

// Delete response
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const deleted = await deleteResponse(id);
    
    if (!deleted) {
      return next(createError('Response not found', HTTP_STATUS.NOT_FOUND));
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Response deleted successfully',
    });
  } catch (error) {
    next(createError('Failed to delete response', HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
});

export { router as responsesRouter }; 