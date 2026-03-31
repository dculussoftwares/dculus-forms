import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { Readable } from 'stream';
import { uploadFile } from '../services/fileUploadService.js';
import { prisma } from '../lib/prisma.js';
import { randomUUID } from 'crypto';
import { logger } from '../lib/logger.js';

const router: Router = Router();

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const { type, formId } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'No file provided', code: 'BAD_USER_INPUT' });
    }

    if (!type) {
      return res.status(400).json({ error: 'File type is required', code: 'BAD_USER_INPUT' });
    }

    // Create a file-like object for the upload service
    const fileObject = {
      filename: file.originalname,
      mimetype: file.mimetype,
      encoding: 'binary',
      createReadStream: () => {
        return new Readable({
          read() {
            this.push(file.buffer);
            this.push(null);
          }
        });
      }
    };

    // Upload the file
    const result = await uploadFile({
      file: fileObject,
      type,
    });

    // If formId is provided and type is FormBackground, save to FormFile table
    if (formId && type === 'FormBackground') {
      await prisma.formFile.create({
        data: {
          id: randomUUID(),
          key: result.key,
          type: result.type,
          formId: formId,
          originalName: result.originalName,
          url: result.url,
          size: result.size,
          mimeType: result.mimeType,
        }
      });
    }

    res.json(result);
  } catch (error) {
    logger.error('Error uploading file:', error);
    res.status(500).json({ 
      error: `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      code: 'UPLOAD_FAILED',
    });
  }
});

// Multer error handler — must be a 4-argument Express error middleware
// This catches FILE_TOO_LARGE before it reaches the generic error handler
router.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File is too large. Maximum allowed size is 5MB.',
        code: 'FILE_TOO_LARGE',
        maxSize: '5MB',
      });
    }
    return res.status(400).json({
      error: err.message,
      code: 'BAD_USER_INPUT',
    });
  }
  // Pass to next error handler if not a multer error
  _next(err);
});

export { router as uploadRouter };