import { generateId } from '@dculus/utils';
import type { Prisma } from '#prisma-client';
import { pdfTemplateRepository, pdfGeneratorRepository } from '../repositories/index.js';
import { copyPdfTemplateAssetForForm } from './fileUploadService.js';
import { logger } from '../lib/logger.js';

/**
 * Copies a form's PDF Templates and PDF Generators onto a duplicated form.
 *
 * Before this, duplicating a form dropped both: a form set up to hand every respondent a
 * generated certificate produced a clone that generated nothing.
 *
 * Field bindings inside a template (`dculusFieldId`, `{{id}}`) and a generator's
 * `filenameFieldId` / `filters` all reference form-field ids, which the schema clone
 * preserves verbatim — so they keep working against the copy without remapping.
 *
 * Generators are copied with `autoRunOnSubmit` forced off: a clone must not silently
 * start generating PDFs the moment it takes its first response. The owner turns that back
 * on deliberately.
 *
 * Failures are logged, not thrown: losing the templates is bad, failing the whole form
 * duplication over it is worse. Mirrors `copyAutomationsToForm`.
 */
export async function copyPdfTemplatesToForm(
  sourceFormId: string,
  targetFormId: string,
  userId: string
): Promise<number> {
  try {
    const [templates, generators] = await Promise.all([
      pdfTemplateRepository.listByForm(sourceFormId),
      pdfGeneratorRepository.listByForm(sourceFormId),
    ]);
    if (templates.length === 0 && generators.length === 0) return 0;

    // old template id -> new template id, so generators can be re-pointed at the copy.
    const templateIdMap = new Map<string, string>();

    for (const template of templates) {
      let newFileKey = template.fileKey;
      if (template.fileKey) {
        try {
          newFileKey = await copyPdfTemplateAssetForForm(template.fileKey, targetFormId);
        } catch (error) {
          logger.error(
            `❌ Failed to copy PDF template asset for duplicated form ${targetFormId}; sharing the source object instead:`,
            error
          );
          // A shared, read-only base PDF still renders; a template with no basePdf does not.
          newFileKey = template.fileKey;
        }
      }

      const created = await pdfTemplateRepository.createTemplate({
        id: generateId(),
        formId: targetFormId,
        name: template.name,
        template: (template.template ?? {}) as Prisma.InputJsonValue,
        fileKey: newFileKey,
        fileName: template.fileName,
        pageCount: template.pageCount,
        createdById: userId,
      });
      templateIdMap.set(template.id, created.id);
    }

    let copiedGenerators = 0;
    for (const generator of generators) {
      const mappedTemplateId = templateIdMap.get(generator.templateId);
      if (!mappedTemplateId) {
        // Its template failed to copy — skip rather than point a generator on the new
        // form at the original form's template.
        logger.warn(
          `⚠️ Skipping PDF generator ${generator.id} during duplication: source template ${generator.templateId} was not copied`
        );
        continue;
      }

      await pdfGeneratorRepository.createGenerator({
        id: generateId(),
        formId: targetFormId,
        templateId: mappedTemplateId,
        name: generator.name,
        columnName: generator.columnName,
        filenameFieldId: generator.filenameFieldId,
        filters: (generator.filters ?? []) as Prisma.InputJsonValue,
        filterLogic: generator.filterLogic,
        autoRunOnSubmit: false,
        enabled: generator.enabled,
        createdById: userId,
      });
      copiedGenerators++;
    }

    logger.info(
      `✅ Copied ${templateIdMap.size} PDF template(s) and ${copiedGenerators} generator(s) from form ${sourceFormId} to ${targetFormId}`
    );
    return templateIdMap.size + copiedGenerators;
  } catch (error) {
    logger.error(
      `❌ Failed to copy PDF templates from form ${sourceFormId} to ${targetFormId}:`,
      error
    );
    return 0;
  }
}
