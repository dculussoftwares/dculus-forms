import { describe, it, expect } from 'vitest';
import { deserializeFormSchema } from '@dculus/types';
import { loadCatalog } from '../loadCatalog.js';
import { buildTemplateSchema, validateCatalog, validateDefinition } from '../validate.js';

const loaded = loadCatalog();
const catalog = loaded.map((l) => l.def);

describe('public template seed data (seed-data/public-templates/*.json)', () => {
  it('has templates and passes every authoring rule', () => {
    expect(catalog.length).toBeGreaterThan(0);
    expect(validateCatalog(loaded)).toEqual([]);
  });

  it('uses every layout at least once', () => {
    const codes = new Set(catalog.map((d) => d.formSchema.layout.code));
    expect([...codes].sort()).toEqual(['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9']);
  });

  it('keeps ids as written and grid pointers intact after normalising', () => {
    for (const def of catalog) {
      const built: any = buildTemplateSchema(def);
      expect(built.pages.map((p: any) => p.fields.map((f: any) => f.id))).toEqual(
        def.formSchema.pages.map((p: any) => p.fields.map((f: any) => f.id))
      );
      expect(buildTemplateSchema(def)).toEqual(built);
      for (const page of built.pages) {
        const ids = new Set(page.fields.map((f: any) => f.id));
        for (const f of page.fields) if (f.gridId) expect(ids.has(f.gridId)).toBe(true);
      }
    }
  });

  it('round-trips through the field classes', () => {
    for (const def of catalog) {
      const schema: any = deserializeFormSchema(buildTemplateSchema(def) as any);
      expect(schema.pages.length).toBe(def.formSchema.pages.length);
    }
  });
});

describe('validation rules', () => {
  const base = catalog[0];

  it('flags bad slugs, thin SEO copy and option-less choices', () => {
    const broken: any = {
      ...base,
      slug: 'Bad Slug',
      seoDescription: 'too short',
      keywords: ['one'],
      formSchema: {
        ...base.formSchema,
        pages: [{ id: 'p', title: 'P', fields: [{ id: 'x', type: 'radio_field', label: 'Pick', options: [] }] }],
      },
    };
    const problems = validateDefinition(broken).join('\n');
    expect(problems).toMatch(/slug must be/);
    expect(problems).toMatch(/seoDescription/);
    expect(problems).toMatch(/keywords/);
    expect(problems).toMatch(/"Pick" has no options/);
  });

  it('catches duplicate slugs, file-name mismatches, shared field ids and category clashes', () => {
    const clash = { ...base, slug: 'business', category: 'Other' };
    const problems = validateCatalog([
      { file: `${base.slug}.json`, def: base },
      { file: 'copy.json', def: base },
      { file: 'business.json', def: clash },
    ]).join('\n');
    expect(problems).toMatch(/used 2 times/);
    expect(problems).toMatch(/copy\.json: file name must be/);
    expect(problems).toMatch(/is used by both/);
    expect(problems).toMatch(/category slug "business" clashes/);
  });

  it('reports missing or wrongly-typed fields instead of throwing', () => {
    const broken: any = { slug: 'x-form', formSchema: { pages: 'nope' } };
    const problems = validateDefinition(broken).join('\n');
    expect(problems).toMatch(/seoDescription must be a non-empty string/);
    expect(problems).toMatch(/keywords must be a list/);
    expect(problems).toMatch(/formSchema.pages must be a list/);
  });

  it('counts keywords and tags after removing blanks and duplicates', () => {
    const problems = validateDefinition({ ...base, keywords: ['contact form', 'CONTACT FORM', ''], tags: [' '] } as any).join('\n');
    expect(problems).toMatch(/keywords: .*\(1 after/);
    expect(problems).toMatch(/tags: .*\(0 after/);
  });

  it('reports a non-list fields value without changing the definition', () => {
    const page = { id: 'p-x', title: 'Bad', fields: 'oops' };
    const def: any = { ...base, formSchema: { ...base.formSchema, pages: [...base.formSchema.pages, page] } };
    expect(validateDefinition(def).join('\n')).toMatch(/page "Bad": fields must be a list/);
    expect(page.fields).toBe('oops');
  });

  it('catches page ids shared between templates', () => {
    const other: any = { ...catalog[1], formSchema: { ...catalog[1].formSchema, pages: [{ ...catalog[1].formSchema.pages[0], id: base.formSchema.pages[0].id }] } };
    const problems = validateCatalog([
      { file: `${base.slug}.json`, def: base },
      { file: `${other.slug}.json`, def: other },
    ]).join('\n');
    expect(problems).toMatch(/page id .* is used by both/);
  });
});
