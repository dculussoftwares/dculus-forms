// Turns a form title into a short stock-media search query.
export function extractSearchKeyword(title: string): string {
  const stopWords = new Set([
    'form', 'survey', 'questionnaire', 'application', 'registration',
    'request', 'feedback', 'the', 'a', 'an', 'of', 'for', 'with',
    'and', 'or', 'my', 'your', 'our', 'new', 'create', 'submit',
    'untitled',
  ]);
  const words = title
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(w => !stopWords.has(w) && w.length > 2);
  return words.slice(0, 2).join(' ') || 'professional office';
}
