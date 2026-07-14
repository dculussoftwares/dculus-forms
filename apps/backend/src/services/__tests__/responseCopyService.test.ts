import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FieldType, deserializeFormSchema } from '@dculus/types';
import { sendResponseCopyIfEnabled, buildResponseSummaryRows } from '../responseCopyService.js';
import { sendEmail } from '../emailService.js';
import { resolveResponsePdfAttachment } from '../pdfTemplateService.js';
import { logger } from '../../lib/logger.js';

vi.mock('../emailService.js');
vi.mock('../pdfTemplateService.js');
vi.mock('../../lib/prisma.js', () => ({ prisma: {} }));

const formSchemaWithEmailField = {
  pages: [
    {
      id: 'page-1',
      title: 'Page 1',
      fields: [
        { id: 'f-email', type: FieldType.EMAIL_FIELD, label: 'Your Email' },
        { id: 'f-name', type: FieldType.TEXT_INPUT_FIELD, label: 'Full Name' },
      ],
    },
  ],
};

const baseForm = {
  id: 'form-123',
  title: 'Feedback Form',
  formSchema: formSchemaWithEmailField,
};

const baseResponse = {
  id: 'response-1',
  data: { 'f-email': 'respondent@example.com', 'f-name': 'Alice' },
};

describe('sendResponseCopyIfEnabled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing when responseCopy is not enabled', async () => {
    await sendResponseCopyIfEnabled({
      form: { ...baseForm, settings: { responseCopy: { enabled: false, mode: 'always' } } },
      response: baseResponse,
      consent: true,
    });

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('does nothing when settings are absent entirely', async () => {
    await sendResponseCopyIfEnabled({
      form: { ...baseForm, settings: null },
      response: baseResponse,
      consent: true,
    });

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('skips sending in respondentChoice mode when consent is false', async () => {
    await sendResponseCopyIfEnabled({
      form: {
        ...baseForm,
        settings: { responseCopy: { enabled: true, mode: 'respondentChoice', emailFieldId: 'f-email' } },
      },
      response: baseResponse,
      consent: false,
    });

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('sends in respondentChoice mode when consent is true', async () => {
    await sendResponseCopyIfEnabled({
      form: {
        ...baseForm,
        settings: { responseCopy: { enabled: true, mode: 'respondentChoice', emailFieldId: 'f-email' } },
      },
      response: baseResponse,
      consent: true,
    });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'respondent@example.com', attachments: undefined })
    );
  });

  it('defaults to requiring consent for any mode value other than the literal "always" (defense in depth against an unvalidated mode)', async () => {
    await sendResponseCopyIfEnabled({
      form: {
        ...baseForm,
        // `mode` has no GraphQL enum — simulate a stored value that isn't one of
        // the two values the frontend RadioGroup can produce.
        settings: { responseCopy: { enabled: true, mode: 'not-a-real-mode' as any, emailFieldId: 'f-email' } },
      },
      response: baseResponse,
      consent: false,
    });

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('sends in always mode regardless of consent', async () => {
    await sendResponseCopyIfEnabled({
      form: {
        ...baseForm,
        settings: { responseCopy: { enabled: true, mode: 'always', emailFieldId: 'f-email' } },
      },
      response: baseResponse,
      consent: false,
    });

    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'respondent@example.com' }));
  });

  it('does nothing when no emailFieldId is configured', async () => {
    await sendResponseCopyIfEnabled({
      form: { ...baseForm, settings: { responseCopy: { enabled: true, mode: 'always' } } },
      response: baseResponse,
      consent: true,
    });

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('does nothing when the form has no schema', async () => {
    await sendResponseCopyIfEnabled({
      form: {
        ...baseForm,
        formSchema: null,
        settings: { responseCopy: { enabled: true, mode: 'always', emailFieldId: 'f-email' } },
      },
      response: baseResponse,
      consent: true,
    });

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('skips when the configured email field no longer exists on the form', async () => {
    const loggerWarn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    await sendResponseCopyIfEnabled({
      form: {
        ...baseForm,
        settings: { responseCopy: { enabled: true, mode: 'always', emailFieldId: 'f-deleted' } },
      },
      response: baseResponse,
      consent: true,
    });

    expect(sendEmail).not.toHaveBeenCalled();
    expect(loggerWarn).toHaveBeenCalledWith(
      'Response copy skipped: configured email field no longer exists on the form',
      expect.objectContaining({ emailFieldId: 'f-deleted' })
    );
    loggerWarn.mockRestore();
  });

  it('skips silently when the recipient field is blank on this response', async () => {
    await sendResponseCopyIfEnabled({
      form: {
        ...baseForm,
        settings: { responseCopy: { enabled: true, mode: 'always', emailFieldId: 'f-email' } },
      },
      response: { id: 'response-2', data: { 'f-email': '', 'f-name': 'Bob' } },
      consent: true,
    });

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('attaches the generated PDF and sends no Q&A summary when a template is configured', async () => {
    vi.mocked(resolveResponsePdfAttachment).mockResolvedValue({
      attachment: { filename: 'copy.pdf', content: Buffer.from('%PDF-1.4'), contentType: 'application/pdf' },
    });

    await sendResponseCopyIfEnabled({
      form: {
        ...baseForm,
        settings: {
          responseCopy: { enabled: true, mode: 'always', emailFieldId: 'f-email', pdfTemplateId: 'template-1' },
        },
      },
      response: baseResponse,
      consent: true,
    });

    expect(resolveResponsePdfAttachment).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ pdfTemplateId: 'template-1', formId: 'form-123', responseId: 'response-1' })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [{ filename: 'copy.pdf', content: expect.any(Buffer), contentType: 'application/pdf' }],
      })
    );
  });

  it('falls back to the Q&A summary when PDF generation fails', async () => {
    const loggerWarn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    vi.mocked(resolveResponsePdfAttachment).mockResolvedValue({ error: 'template not found' });

    await sendResponseCopyIfEnabled({
      form: {
        ...baseForm,
        settings: {
          responseCopy: { enabled: true, mode: 'always', emailFieldId: 'f-email', pdfTemplateId: 'template-1' },
        },
      },
      response: baseResponse,
      consent: true,
    });

    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ attachments: undefined, to: 'respondent@example.com' }));
    loggerWarn.mockRestore();
  });

  it('uses a custom subject when configured, and a default otherwise', async () => {
    await sendResponseCopyIfEnabled({
      form: {
        ...baseForm,
        settings: {
          responseCopy: { enabled: true, mode: 'always', emailFieldId: 'f-email', subject: 'Custom subject' },
        },
      },
      response: baseResponse,
      consent: true,
    });

    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ subject: 'Custom subject' }));

    vi.clearAllMocks();

    await sendResponseCopyIfEnabled({
      form: { ...baseForm, settings: { responseCopy: { enabled: true, mode: 'always', emailFieldId: 'f-email' } } },
      response: baseResponse,
      consent: true,
    });

    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ subject: 'Your response to Feedback Form' }));
  });
});

describe('buildResponseSummaryRows', () => {
  const schema = {
    pages: [
      {
        id: 'page-1',
        title: 'Page 1',
        fields: [
          { id: 'f-name', type: FieldType.TEXT_INPUT_FIELD, label: 'Full Name' },
          { id: 'f-opts', type: FieldType.CHECKBOX_FIELD, label: 'Interests', options: ['A', 'B'] },
          { id: 'f-file', type: FieldType.FILE_UPLOAD_FIELD, label: 'Attachment' },
          { id: 'f-intro', type: FieldType.RICH_TEXT_FIELD, content: '<p>Welcome</p>' },
        ],
      },
    ],
  };

  it('formats text, checkbox, and file-upload answers, and skips non-fillable fields', () => {
    const rows = buildResponseSummaryRows(deserializeFormSchema(schema), {
      'f-name': 'Bob <script>',
      'f-opts': ['A', 'B'],
      'f-file': ['responses/form-123/resp-1/photo.png'],
    });

    expect(rows).toHaveLength(3); // f-intro (RichTextFormField) excluded
    expect(rows[0]).toEqual({ label: 'Full Name', answer: 'Bob &lt;script&gt;' });
    expect(rows[1]).toEqual({ label: 'Interests', answer: 'A, B' });
    expect(rows[2]).toEqual({ label: 'Attachment', answer: 'photo.png' });
  });

  it('renders an em-dash placeholder for missing answers', () => {
    const rows = buildResponseSummaryRows(deserializeFormSchema(schema), {});
    expect(rows.every((r) => r.answer === '&mdash;')).toBe(true);
  });
});
