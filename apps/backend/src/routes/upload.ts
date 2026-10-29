import {
  Router,
  type Request,
  type Response,
  type NextFunction,
  type RequestHandler,
} from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { Readable } from 'stream';
import { uploadFile } from '../services/fileUploadService.js';
import { prisma } from '../lib/prisma.js';
import { randomUUID } from 'crypto';
import { logger } from '../lib/logger.js';
import { auth } from '../lib/better-auth.js';
import { fromNodeHeaders } from 'better-auth/node';
import { checkFormAccess, PermissionLevel } from '../graphql/resolvers/formSharing.js';

// Allowed upload type values — prevents arbitrary path injection via type param
const ALLOWED_UPLOAD_TYPES = new Set([
  'FormTemplate',
  'FormBackground',
  'UserAvatar',
  'OrganizationLogo',
  'FormResponse',
  'PdfTemplateAsset',
]);

const MB = 1024 * 1024;

// Per-type byte caps, matching the caps fileUploadService enforces after buffering.
// Enforced up front (Content-Length) and by multer so oversized bodies never fill memory.
// FormResponse is 50MB because FileUploadField.maxFileSizeMb allows up to 50.
const MAX_UPLOAD_BYTES: Record<string, number> = {
  FormTemplate: 5 * MB,
  UserAvatar: 5 * MB,
  OrganizationLogo: 5 * MB,
  FormBackground: 45 * MB, // stock HD video backgrounds
  PdfTemplateAsset: 10 * MB,
  FormResponse: 50 * MB,
};
const DEFAULT_MAX_UPLOAD_BYTES = 50 * MB;
// Unauthenticated respondents may only upload FormResponse files; keep their ceiling lower.
const MAX_ANONYMOUS_UPLOAD_BYTES = 25 * MB;
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

// Each in-flight upload holds up to its cap in memory (multer memoryStorage), so bound them.
const MAX_CONCURRENT_UPLOADS = 10;
const MAX_CONCURRENT_ANONYMOUS_UPLOADS = 4;

const isTestEnv = process.env.NODE_ENV === 'test';

const anonymousUploadLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  message: { error: 'Too many upload requests, please try again later', code: 'RATE_LIMITED' },
});

const router: Router = Router();

interface UploadParams {
  type?: string;
  formId?: string;
  organizationId?: string;
}

interface UploadRejection {
  status: number;
  body: { error: string; code: string; [key: string]: unknown };
}

type CallerUser = { id: string; role?: string | null } | null;

const reject = (status: number, body: UploadRejection['body']): UploadRejection => ({ status, body });

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

let inFlightUploads = 0;
let inFlightAnonymousUploads = 0;

const uploaderCache = new Map<number, RequestHandler>();

// One multer instance per size cap. Buffers the single file in memory, so the cap
// (not a blanket 50MB) is what bounds memory per request.
function getUploader(maxBytes: number): RequestHandler {
  let uploader = uploaderCache.get(maxBytes);
  if (!uploader) {
    uploader = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: maxBytes, files: 1, fields: 10 },
    }).single('file');
    uploaderCache.set(maxBytes, uploader);
  }
  return uploader;
}

function maxBytesFor(type: string | undefined, callerUser: CallerUser): number {
  const typeCap = (type && MAX_UPLOAD_BYTES[type]) || DEFAULT_MAX_UPLOAD_BYTES;
  return callerUser ? typeCap : Math.min(typeCap, MAX_ANONYMOUS_UPLOAD_BYTES);
}

/**
 * Per-type authorization. Returns a rejection, or null when the caller may upload.
 * form-app sends cookies (credentials: 'include'); the public form viewer sends none.
 */
async function authorizeUpload(
  { type, formId, organizationId }: UploadParams,
  callerUser: CallerUser
): Promise<UploadRejection | null> {
    if (type === 'FormTemplate') {
      // Only admin / superAdmin may upload templates
      if (!callerUser) {
        return reject(401, { error: 'Authentication required', code: 'UNAUTHENTICATED' });
      }
      if (callerUser.role !== 'admin' && callerUser.role !== 'superAdmin') {
        return reject(403, { error: 'Admin privileges required', code: 'FORBIDDEN' });
      }
    } else if (type === 'FormBackground') {
      if (!formId) {
        return reject(400, { error: 'formId is required for FormBackground uploads', code: 'BAD_USER_INPUT' });
      }
      if (!callerUser) {
        return reject(401, { error: 'Authentication required', code: 'UNAUTHENTICATED' });
      }
      const accessCheck = await checkFormAccess(callerUser.id, formId, PermissionLevel.EDITOR);
      if (!accessCheck.hasAccess) {
        return reject(403, { error: 'EDITOR access required for form background uploads', code: 'FORBIDDEN' });
      }
    } else if (type === 'PdfTemplateAsset') {
      if (!formId) {
        return reject(400, { error: 'formId is required for PdfTemplateAsset uploads', code: 'BAD_USER_INPUT' });
      }
      if (!callerUser) {
        return reject(401, { error: 'Authentication required', code: 'UNAUTHENTICATED' });
      }
      const accessCheck = await checkFormAccess(callerUser.id, formId, PermissionLevel.EDITOR);
      if (!accessCheck.hasAccess) {
        return reject(403, { error: 'EDITOR access required for PDF template uploads', code: 'FORBIDDEN' });
      }
    } else if (type === 'UserAvatar') {
      if (!callerUser) {
        return reject(401, { error: 'Authentication required', code: 'UNAUTHENTICATED' });
      }
    } else if (type === 'OrganizationLogo') {
      const orgId = organizationId;
      if (!orgId) {
        return reject(400, { error: 'organizationId is required for OrganizationLogo uploads', code: 'BAD_USER_INPUT' });
      }
      if (!callerUser) {
        return reject(401, { error: 'Authentication required', code: 'UNAUTHENTICATED' });
      }
      const membership = await prisma.member.findFirst({
        where: { organizationId: orgId, userId: callerUser.id },
        select: { role: true },
      });
      if (!membership) {
        return reject(403, { error: 'Organization membership required', code: 'FORBIDDEN' });
      }
      if (membership.role !== 'owner') {
        return reject(403, { error: 'Only org owners can update the organization logo', code: 'FORBIDDEN' });
      }
    } else if (type === 'FormResponse') {
      // Public submissions require isPublished === true.
      // Authenticated editors/owners may upload regardless of published state.
      if (!formId) {
        return reject(400, {
          error: 'formId is required for form response uploads',
          code: 'BAD_USER_INPUT',
        });
      }
      const form = await prisma.form.findUnique({
        where: { id: formId },
        select: { id: true, isPublished: true, organizationId: true, createdById: true },
      });
      if (!form) {
        return reject(404, { error: 'Form not found', code: 'NOT_FOUND' });
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
        return reject(403, {
          error: 'Form is not accepting submissions',
          code: 'FORBIDDEN',
        });
      }
    }

  return null;
}

// Resolves when the middleware calls next() or has already answered the request
// (express-rate-limit responds with 429 and never calls next).
const asMiddleware = (middleware: RequestHandler, req: Request, res: Response): Promise<void> =>
  new Promise((resolve, fail) => {
    res.once('close', resolve);
    middleware(req, res, (err?: unknown) => (err ? fail(err) : resolve()));
  });

/**
 * Runs before multer so nothing is buffered until the request is known to be
 * acceptable: size caps from Content-Length, auth/type checks (when `type` is in
 * the query string), a concurrency cap and a stricter limiter for anonymous callers.
 *
 * `type`, `formId` and `organizationId` are accepted in the query string or the
 * multipart body. The query string wins; when it carries `type`, the body values
 * are ignored entirely so they cannot diverge from what was authorized here.
 */
const preflight: RequestHandler = async (req, res, next) => {
  try {
    let callerUser: CallerUser = null;
    try {
      const sessionData = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      callerUser = sessionData?.user ? { id: sessionData.user.id, role: sessionData.user.role } : null;
    } catch {
      // Non-fatal: unauthenticated callers are handled per-type below
    }
    res.locals.callerUser = callerUser;

    if (!callerUser) {
      await asMiddleware(anonymousUploadLimiter, req, res);
      if (res.headersSent) return;
    }

    const queryType = asString(req.query.type);
    if (queryType) {
      if (!ALLOWED_UPLOAD_TYPES.has(queryType)) {
        return res.status(400).json({ error: 'Invalid upload type', code: 'BAD_USER_INPUT' });
      }
      const params: UploadParams = {
        type: queryType,
        formId: asString(req.query.formId),
        organizationId: asString(req.query.organizationId),
      };
      const rejection = await authorizeUpload(params, callerUser);
      if (rejection) return res.status(rejection.status).json(rejection.body);
      res.locals.uploadParams = params;
    }

    const maxBytes = maxBytesFor(queryType, callerUser);
    res.locals.uploadMaxBytes = maxBytes;

    const contentLength = Number(req.headers['content-length']);
    if (Number.isFinite(contentLength) && contentLength > maxBytes + MULTIPART_OVERHEAD_BYTES) {
      return res.status(413).json({
        error: `File is too large. Maximum allowed size is ${Math.round(maxBytes / MB)}MB.`,
        code: 'FILE_TOO_LARGE',
        maxSize: `${Math.round(maxBytes / MB)}MB`,
      });
    }

    if (
      inFlightUploads >= MAX_CONCURRENT_UPLOADS ||
      (!callerUser && inFlightAnonymousUploads >= MAX_CONCURRENT_ANONYMOUS_UPLOADS)
    ) {
      res.setHeader('Retry-After', '5');
      return res
        .status(503)
        .json({ error: 'Too many uploads in progress, please retry shortly', code: 'UPLOAD_BUSY' });
    }

    inFlightUploads += 1;
    if (!callerUser) inFlightAnonymousUploads += 1;
    let released = false;
    res.on('close', () => {
      if (released) return;
      released = true;
      inFlightUploads -= 1;
      if (!callerUser) inFlightAnonymousUploads -= 1;
    });

    next();
  } catch (error) {
    logger.error('Upload preflight failed:', error);
    res.status(500).json({ error: 'Failed to upload file', code: 'UPLOAD_FAILED' });
  }
};

const receiveFile: RequestHandler = (req, res, next) =>
  getUploader(res.locals.uploadMaxBytes as number)(req, res, next);

router.post('/upload', preflight, receiveFile, async (req, res) => {
  try {
    const file = req.file;
    const callerUser = res.locals.callerUser as CallerUser;
    const preAuthorized = res.locals.uploadParams as UploadParams | undefined;
    const params: UploadParams = preAuthorized ?? {
      type: asString(req.body?.type),
      formId: asString(req.body?.formId),
      organizationId: asString(req.body?.organizationId),
    };
    const { type, formId } = params;

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

    if (!preAuthorized) {
      const rejection = await authorizeUpload(params, callerUser);
      if (rejection) return res.status(rejection.status).json(rejection.body);
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

    // Record form-scoped uploads so their original name, size and type stay known
    if (formId && (type === 'FormBackground' || type === 'FormResponse')) {
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

    // fileUploadService throws a plain Error (not a MulterError) when a file exceeds
    // one of its type-specific caps (image 5MB, video 20MB, PDF 10MB) — surface it the
    // same way as the multer-level 50MB rejection below so the frontend's FILE_TOO_LARGE
    // handling (and its friendly "too large" messaging) actually applies to it too.
    if (error instanceof Error && /exceeds maximum allowed size/.test(error.message)) {
      return res.status(413).json({
        error: error.message,
        code: 'FILE_TOO_LARGE',
      });
    }

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
      const maxSize = `${Math.round(((res.locals.uploadMaxBytes as number | undefined) ?? DEFAULT_MAX_UPLOAD_BYTES) / MB)}MB`;
      return res.status(413).json({
        error: `File is too large. Maximum allowed size is ${maxSize}.`,
        code: 'FILE_TOO_LARGE',
        maxSize,
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
