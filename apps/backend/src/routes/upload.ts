import { Router } from 'express';
import multer from 'multer';
import { Readable } from 'stream';
import { uploadFile } from '../services/fileUploadService.js';
import { prisma } from '../lib/prisma.js';
import { randomUUID } from 'crypto';

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
      return res.status(400).json({ error: 'No file provided' });
    }

    if (!type) {
      return res.status(400).json({ error: 'File type is required' });
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
    console.error('Error uploading file:', error);
    res.status(500).json({ 
      error: `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}` 
    });
  }
});

export { router as uploadRouter };