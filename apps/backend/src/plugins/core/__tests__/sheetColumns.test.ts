import { describe, it, expect } from 'vitest';
import {
  bootstrapColumnsFromHeader,
  carrySheetColumns,
  carrySheetColumnsInGraph,
  type SchemaFieldInfo,
} from '../sheetColumns.js';

const field = (id: string, label: string, deleted = false): SchemaFieldInfo => ({ id, label, deleted });

describe('bootstrapColumnsFromHeader', () => {
  it('matches uniquely labelled columns to fields and keeps unmatched ones as blank placeholders', () => {
    const columns = bootstrapColumnsFromHeader(
      ['Name', 'Removed', 'Submitted At', 'Response ID'],
      [field('name', 'Name')]
    );

    expect(columns.map((c) => c.id)).toEqual(['name', '__unknown:1', '__submittedAt', '__responseId']);
  });

  it('does not claim a field for a label shared by several fields', () => {
    const columns = bootstrapColumnsFromHeader(
      ['Phone', 'Phone', 'Submitted At', 'Response ID'],
      [field('b', 'Phone'), field('a', 'Phone')]
    );

    expect(columns.map((c) => c.id)).toEqual(['__unknown:0', '__unknown:1', '__submittedAt', '__responseId']);
  });

  it('takes the trailing columns as the fixed ones when a form field has the same label', () => {
    const columns = bootstrapColumnsFromHeader(
      ['Response ID', 'Name', 'Submitted At', 'Response ID'],
      [field('rid', 'Response ID'), field('name', 'Name')]
    );

    expect(columns.map((c) => c.id)).toEqual(['rid', 'name', '__submittedAt', '__responseId']);
  });
});

describe('carrySheetColumns', () => {
  const layout = [{ id: 'name', label: 'Name' }];

  it('keeps the persisted layout when a stale save carries none', () => {
    const existing = { type: 'google-sheets', spreadsheetId: 's1', sheetColumns: layout };
    const incoming = { type: 'google-sheets', spreadsheetId: 's1', spreadsheetUrl: 'u' };

    expect(carrySheetColumns(existing, incoming)).toEqual({ ...incoming, sheetColumns: layout });
  });

  it('drops the layout when the worksheet name changes', () => {
    const existing = { type: 'microsoft-sheets', workbookId: 'w1', worksheetName: 'Sheet1', sheetColumns: layout };
    const incoming = { type: 'microsoft-sheets', workbookId: 'w1', worksheetName: 'Other' };

    expect(carrySheetColumns(existing, incoming)).toBe(incoming);
  });

  it('drops the layout when the document differs', () => {
    const existing = { spreadsheetId: 's1', sheetColumns: layout };
    const incoming = { spreadsheetId: 's2' };

    expect(carrySheetColumns(existing, incoming)).toBe(incoming);
  });

  it('keeps the created document when a stale form saves without one', () => {
    const existing = { type: 'microsoft-sheets', workbookId: 'w1', workbookUrl: 'u1', sheetColumns: layout };
    const incoming = { type: 'microsoft-sheets', worksheetName: 'Sheet1' };

    expect(carrySheetColumns(existing, incoming)).toEqual({ ...existing, worksheetName: 'Sheet1' });
  });

  it('does not carry a document across plugin types', () => {
    const existing = { type: 'google-sheets', spreadsheetId: 's1' };
    const incoming = { type: 'microsoft-sheets' };

    expect(carrySheetColumns(existing, incoming)).toBe(incoming);
  });

  it('fixes the destination folder once the document exists', () => {
    const folder = { id: 'f1', name: 'Reports' };
    const existing = { spreadsheetId: 's1', destinationFolder: folder };

    expect(carrySheetColumns(existing, { spreadsheetId: 's1', destinationFolder: { id: 'f2', name: 'Other' } }))
      .toEqual(existing);
    expect(carrySheetColumns(existing, { spreadsheetId: 's1' })).toEqual(existing);
  });

  it('ignores a folder added after the document was created in the root', () => {
    const existing = { spreadsheetId: 's1' };
    const incoming = { spreadsheetId: 's1', destinationFolder: { id: 'f2', name: 'Other' } };

    expect(carrySheetColumns(existing, incoming)).toEqual({ spreadsheetId: 's1' });
  });

  it('accepts a folder while no document exists yet', () => {
    const incoming = { destinationFolder: { id: 'f1', name: 'Reports' } };

    expect(carrySheetColumns({ type: 'google-sheets' }, incoming)).toBe(incoming);
  });
});

describe('carrySheetColumnsInGraph', () => {
  const layout = [{ id: 'name', label: 'Name' }];
  const graphWith = (config: Record<string, unknown>) => ({
    nodes: [{ id: 'n1', type: 'action', data: { config } }, { id: 'end', type: 'end' }],
    edges: [],
  });

  it('restores the layout on the matching action node', () => {
    const existing = graphWith({ spreadsheetId: 's1', sheetColumns: layout });
    const next = graphWith({ spreadsheetId: 's1' });

    const result = carrySheetColumnsInGraph(existing, next);

    expect(result.nodes[0].data?.config).toEqual({ spreadsheetId: 's1', sheetColumns: layout });
  });

  it('returns the same graph object when nothing needs carrying', () => {
    const next = graphWith({ spreadsheetId: 's1' });

    expect(carrySheetColumnsInGraph(graphWith({ spreadsheetId: 's1' }), next)).toBe(next);
  });
});
