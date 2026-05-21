import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import multer from 'multer';
import { Readable } from 'stream';
import { uploadFile } from '../services/fileUploadService.js';
import { prisma } from '../lib/prisma.js';
import { randomUUID } from 'crypto';
import { logger } from '../lib/logger.js';
import { auth } from '../lib/better-auth.js';
import { fromNodeHeaders } from 'better-auth/node';

// Allowed upload type values — prevents arbitrary path injection via type param
const ALLOWED_UPLOAD_TYPES = new Set([
  'FormTemplate',
  'FormBackground',
  'UserAvatar',
  'OrganizationLogo',
  'FormResponse',
]);

const router: Router = Router();

// Configure multer for memory storage
// 50MB to accommodate FormResponse file uploads (max FileUploadField.maxFileSizeMb)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const { type, formId } = req.body;

    if (!file) {
      return res
        .status(400)
        .json({ error: 'No file provided', code: 'BAD_USER_INPUT' });
    }

    if (!type) {
      return res
        .status(400)
        .json({ error: 'File type is required', code: 'BAD_USER_INPUT' });
    }

    // Whitelist check — reject unknown type values
    if (!ALLOWED_UPLOAD_TYPES.has(type)) {
      return res
        .status(400)
        .json({ error: 'Invalid upload type', code: 'BAD_USER_INPUT' });
    }

    // Resolve session once — used by all type-specific auth checks below.
    // form-app sends cookies (credentials: 'include'); public form viewer sends nothing.
    let callerUser: { id: string; role?: string } | null = null;
    try {
      const sessionData = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      callerUser = sessionData?.user ?? null;
    } catch {
      // Non-fatal: unauthenticated callers are handled per-type below
    }

    if (type === 'FormTemplate') {
      // Only admin / superAdmin may upload templates
      if (!callerUser) {
        return res.status(401).json({ error: 'Authentication required', code: 'UNAUTHENTICATED' });
      }
      if (callerUser.role !== 'admin' && callerUser.role !== 'superAdmin') {
        return res.status(403).json({ error: 'Admin privileges required', code: 'FORBIDDEN' });
      }
    } else if (type === 'FormBackground') {
      if (!formId) {
        return res.status(400).json({ error: 'formId is required for FormBackground uploads', code: 'BAD_USER_INPUT' });
      }
      if (!callerUser) {
        return res.status(401).json({ error: 'Authentication required', code: 'UNAUTHENTICATED' });
      }
      const bgForm = await prisma.form.findUnique({
        where: { id: formId },
        select: { id: true, createdById: true, organizationId: true },
      });
      if (!bgForm) {
        return res.status(404).json({ error: 'Form not found', code: 'NOT_FOUND' });
      }
      const isOwner = bgForm.createdById === callerUser.id;
      if (!isOwner) {
        const explicitPermission = await prisma.formPermission.findUnique({
          where: { formId_userId: { formId: bgForm.id, userId: callerUser.id } },
          select: { permission: true },
        });
        const hasEditorPermission =
          explicitPermission?.permission === 'EDITOR' ||
          explicitPermission?.permission === 'OWNER';
        const orgMembership = !hasEditorPermission
          ? await prisma.member.findFirst({
              where: { organizationId: bgForm.organizationId, userId: callerUser.id },
              select: { role: true },
            })
          : null;
        if (!hasEditorPermission && orgMembership?.role !== 'owner') {
          return res.status(403).json({ error: 'EDITOR access required', code: 'FORBIDDEN' });
        }
      }
    } else if (type === 'UserAvatar') {
      if (!callerUser) {
        return res.status(401).json({ error: 'Authentication required', code: 'UNAUTHENTICATED' });
      }
    } else if (type === 'OrganizationLogo') {
      const orgId = req.body.organizationId as string | undefined;
      if (!orgId) {
        return res.status(400).json({ error: 'organizationId is required for OrganizationLogo uploads', code: 'BAD_USER_INPUT' });
      }
      if (!callerUser) {
        return res.status(401).json({ error: 'Authentication required', code: 'UNAUTHENTICATED' });
      }
      const membership = await prisma.member.findFirst({
        where: { organizationId: orgId, userId: callerUser.id },
        select: { role: true },
      });
      if (!membership) {
        return res.status(403).json({ error: 'Organization membership required', code: 'FORBIDDEN' });
      }
      if (membership.role !== 'owner') {
        return res.status(403).json({ error: 'Only org owners can update the organization logo', code: 'FORBIDDEN' });
      }
    } else if (type === 'FormResponse') {
      // Public submissions require isPublished === true.
      // Authenticated editors/owners may upload regardless of published state.
      if (!formId) {
        return res.status(400).json({
          error: 'formId is required for form response uploads',
          code: 'BAD_USER_INPUT',
        });
      }
      const form = await prisma.form.findUnique({
        where: { id: formId },
        select: { id: true, isPublished: true, organizationId: true, createdById: true },
      });
      if (!form) {
        return res
          .status(404)
          .json({ error: 'Form not found', code: 'NOT_FOUND' });
      }

      let isAuthorisedEditor = false;
      if (callerUser) {
        if (form.createdById === callerUser.id) {
          isAuthorisedEditor = true;
        } else {
          const permission = await prisma.formPermission.findUnique({
            where: { formId_userId: { formId: form.id, userId: callerUser.id } },
            select: { permission: true },
          });
          if (permission?.permission === 'EDITOR' || permission?.permission === 'OWNER') {
            isAuthorisedEditor = true;
          }
          if (!isAuthorisedEditor) {
            const membership = await prisma.member.findFirst({
              where: { organizationId: form.organizationId, userId: callerUser.id },
              select: { role: true },
            });
            if (membership?.role === 'owner') {
              isAuthorisedEditor = true;
            }
          }
        }
      }

      if (!isAuthorisedEditor && !form.isPublished) {
        return res.status(403).json({
          error: 'Form is not accepting submissions',
          code: 'FORBIDDEN',
        });
      }
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
          },
        });
      },
    };

    // Upload the file
    const result = await uploadFile({
      file: fileObject,
      type,
      formId: formId || undefined,
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
        },
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
        error: 'File is too large. Maximum allowed size is 50MB.',
        code: 'FILE_TOO_LARGE',
        maxSize: '50MB',
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
