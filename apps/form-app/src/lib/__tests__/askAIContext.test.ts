import { resolveAskAIContextDetail, type AskAIBuilderContext } from '../askAIContext';

const pages = [
  { id: 'page-1', title: 'About you' },
  { id: 'page-2', title: 'Your request' },
];

describe('resolveAskAIContextDetail', () => {
  it('resolves the intro screen on the Content tab', () => {
    const ctx: AskAIBuilderContext = { activeTab: 'content', selection: { kind: 'intro' } };
    expect(resolveAskAIContextDetail(ctx, pages)).toEqual({ kind: 'intro' });
  });

  it('resolves the thank-you (ending) screen on the Content tab', () => {
    const ctx: AskAIBuilderContext = { activeTab: 'content', selection: { kind: 'thankYou' } };
    expect(resolveAskAIContextDetail(ctx, pages)).toEqual({ kind: 'thankYou' });
  });

  it('resolves a page selection to its title', () => {
    const ctx: AskAIBuilderContext = {
      activeTab: 'content',
      selection: { kind: 'page', pageId: 'page-2' },
    };
    expect(resolveAskAIContextDetail(ctx, pages)).toEqual({ kind: 'page', pageTitle: 'Your request' });
  });

  it('falls back to an empty page title when the page id is not found', () => {
    const ctx: AskAIBuilderContext = {
      activeTab: 'content',
      selection: { kind: 'page', pageId: 'missing' },
    };
    expect(resolveAskAIContextDetail(ctx, pages)).toEqual({ kind: 'page', pageTitle: '' });
  });

  it('resolves a field selection using the passed-through fieldLabel', () => {
    const ctx: AskAIBuilderContext = {
      activeTab: 'content',
      selection: { kind: 'field', pageId: 'page-1', fieldId: 'f1', fieldLabel: 'Full name' },
    };
    expect(resolveAskAIContextDetail(ctx, pages)).toEqual({ kind: 'field', fieldLabel: 'Full name' });
  });

  it('falls back to an empty field label when none is provided', () => {
    const ctx: AskAIBuilderContext = {
      activeTab: 'content',
      selection: { kind: 'field', pageId: 'page-1', fieldId: 'f1' },
    };
    expect(resolveAskAIContextDetail(ctx, pages)).toEqual({ kind: 'field', fieldLabel: '' });
  });

  it('shows no detail on the Logic tab, even with a selection present', () => {
    const ctx: AskAIBuilderContext = {
      activeTab: 'logic',
      selection: { kind: 'field', pageId: 'page-1', fieldId: 'f1', fieldLabel: 'Full name' },
    };
    expect(resolveAskAIContextDetail(ctx, pages)).toEqual({ kind: 'none' });
  });

  it('shows no detail on the Automations tab', () => {
    const ctx: AskAIBuilderContext = { activeTab: 'automations', selection: { kind: 'page', pageId: 'page-1' } };
    expect(resolveAskAIContextDetail(ctx, pages)).toEqual({ kind: 'none' });
  });

  it('shows no detail on the Content tab when there is no selection', () => {
    const ctx: AskAIBuilderContext = { activeTab: 'content' };
    expect(resolveAskAIContextDetail(ctx, pages)).toEqual({ kind: 'none' });
  });
});
