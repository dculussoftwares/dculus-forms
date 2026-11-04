/**
 * Renders every seed-data public template's generated images to local PNGs —
 * no database or bucket needed, only PEXELS_API_KEY / PIXABAY_API_KEY for photos.
 * Use it to check a new template's thumbnail and share card before seeding.
 *
 *   pnpm templates:preview                       # all → ./template-previews
 *   pnpm templates:preview --only=contact-form --out=/tmp/previews
 */
import './load-env.js';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { loadCatalog } from '../publicTemplates/loadCatalog.js';
import { buildTemplateSchema, validateCatalog } from '../publicTemplates/validate.js';
import { resolvePhoto } from '../publicTemplates/photos.js';
import { describeSchema } from '../services/og/describe.js';
import { CARD_SIZE, SHARE_SIZE, formShare, templateCard, templateShare } from '../services/og/designs.js';
import { renderPng } from '../services/og/render.js';
import { templateHeading } from '../services/og/heading.js';

const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const out = path.resolve(args.find((a) => a.startsWith('--out='))?.slice(6) ?? 'template-previews');

async function main() {
  const loaded = loadCatalog();
  const problems = validateCatalog(loaded);
  if (problems.length) console.warn(`⚠️  Catalog problems:\n- ${problems.join('\n- ')}`);
  await mkdir(out, { recursive: true });

  for (const def of loaded.map((l) => l.def).filter((d) => !only || only.includes(d.slug))) {
    const photo = await resolvePhoto(def.photo);
    const schema: any = buildTemplateSchema(def);
    schema.layout.backgroundDominantColor = photo.dominantColor;
    const summary = describeSchema(schema);
    const small = `data:image/jpeg;base64,${photo.jpeg.toString('base64')}`;
    const title = summary.headline ?? def.name;

    const files: Array<[string, Promise<Buffer>]> = [
      [`${def.slug}.card.png`, renderPng(templateCard({ summary, title, photo: small }), CARD_SIZE)],
      [
        `${def.slug}.share.png`,
        renderPng(templateShare({ summary, title, heading: templateHeading(def.name), category: def.category, photo: small }), SHARE_SIZE),
      ],
      // What a form created from this template looks like when its link is shared.
      [`${def.slug}.form-share.png`, renderPng(formShare({ summary, title: def.name, description: summary.intro, photo: small }), SHARE_SIZE)],
    ];
    for (const [name, png] of files) await writeFile(path.join(out, name), await png);
    console.log(`✔ ${def.slug} (${def.formSchema.layout.code}, photo ${photo.ref.source} ${photo.ref.id})`);
  }
  console.log(`Wrote previews to ${out}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
