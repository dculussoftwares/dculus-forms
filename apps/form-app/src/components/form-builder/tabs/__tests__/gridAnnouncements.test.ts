import { GridField, TextInputField, FillableFormFieldValidation, type FormPage } from '@dculus/types';
import { createGridAnnouncements } from '../gridAnnouncements';

jest.unmock('@dculus/types');

const t = (key: string, options?: { values?: Record<string, string | number> }) =>
  `${key}${options?.values ? ` ${JSON.stringify(options.values)}` : ''}`;

const pages: FormPage[] = [
  {
    id: 'p1',
    title: 'Page',
    order: 0,
    fields: [new GridField('g', [40, 30, 30])],
  },
];

const active = {
  id: 'existing-field-a',
  data: {
    current: {
      type: 'existing-field',
      field: new TextInputField('a', 'Email', '', '', '', '', new FillableFormFieldValidation(false)),
    },
  },
  rect: { current: { initial: null, translated: null } },
} as any;

const over = (data: Record<string, unknown>) =>
  ({ id: 'over', data: { current: data }, rect: {}, disabled: false } as any);

const announcements = createGridAnnouncements(t, () => pages);

describe('createGridAnnouncements', () => {
  it('announces the dragged question by its label', () => {
    expect(announcements.onDragStart({ active })).toBe('dnd.picked {"label":"Email"}');
  });

  it('announces "column N of M" over a grid slot or column', () => {
    expect(
      announcements.onDragOver({ active, over: over({ type: 'grid-slot', gridId: 'g', column: 1 }) } as any)
    ).toBe('dnd.overColumn {"label":"Email","column":2,"total":3}');
    expect(
      announcements.onDragEnd({ active, over: over({ type: 'grid-column', gridId: 'g', column: 2 }) } as any)
    ).toBe('dnd.droppedColumn {"label":"Email","column":3,"total":3}');
  });

  it('announces top-level targets, misses and cancels without a column', () => {
    expect(
      announcements.onDragOver({ active, over: over({ type: 'field-insert', pageId: 'p1' }) } as any)
    ).toBe('dnd.overPage {"label":"Email"}');
    expect(announcements.onDragOver({ active, over: null } as any)).toBe('dnd.notOver {"label":"Email"}');
    expect(announcements.onDragCancel({ active, over: null } as any)).toBe('dnd.cancelled {"label":"Email"}');
  });

  it('falls back to a generic name for an unlabelled drag', () => {
    const unlabelled = { ...active, data: { current: { type: 'field-type', fieldType: { label: '' } } } };
    expect(announcements.onDragStart({ active: unlabelled })).toBe('dnd.picked {"label":"dnd.item"}');
  });
});
