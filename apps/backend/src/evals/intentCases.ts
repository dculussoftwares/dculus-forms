import type { IntentTier } from '../lib/intentClassifier.js';

/**
 * Labelled user messages for the chat intent router. `expected` is the cheapest tier that can
 * still do the job: 'question' turns get NO tools, so anything that edits the form must not
 * land there.
 */
export const INTENT_CASES: ReadonlyArray<{ message: string; expected: IntentTier }> = [
  // simple — single edits
  { message: 'add an email field', expected: 'simple' },
  { message: 'Add a phone number question', expected: 'simple' },
  { message: 'add a dropdown for country with India, USA, UK', expected: 'simple' },
  { message: 'rename "Full name" to "Your name"', expected: 'simple' },
  { message: 'make the email field required', expected: 'simple' },
  { message: 'delete the age question', expected: 'simple' },
  { message: 'move the phone field above email', expected: 'simple' },
  { message: 'add a new page called Payment', expected: 'simple' },
  { message: 'change the submit button to "Register now"', expected: 'simple' },
  { message: 'change the placeholder of name to "Jane Doe"', expected: 'simple' },
  { message: 'add a quiz question about the capital of France', expected: 'simple' },
  { message: 'yes', expected: 'simple' },
  { message: 'undo that', expected: 'simple' },
  { message: 'Can you add a date of birth field?', expected: 'simple' },
  { message: 'How do I make the phone field optional? Just do it for me', expected: 'simple' },
  // complex — analysis, bulk, multi-step, integrations
  { message: 'review my form and suggest improvements', expected: 'complex' },
  { message: 'merge page 2 and page 3', expected: 'complex' },
  { message: 'make all fields required', expected: 'complex' },
  { message: 'remix this into a customer feedback survey', expected: 'complex' },
  { message: 'send me an email when someone submits', expected: 'complex' },
  { message: 'add a webhook to https://example.com/hook', expected: 'complex' },
  { message: 'suggest validation rules for my fields', expected: 'complex' },
  { message: "what's missing from this form?", expected: 'complex' },
  { message: 'reorganize the form into logical sections', expected: 'complex' },
  { message: 'convert this into a quiz', expected: 'complex' },
  // complex — needs a full-tier tool (conditions, type change, cross-page relocation)
  { message: 'show the phone field only if contact method is Phone', expected: 'complex' },
  { message: 'hide page 3 when the answer to "Attending?" is No', expected: 'complex' },
  { message: 'add a condition so the address field shows only for delivery', expected: 'complex' },
  { message: 'skip to the last page if they choose No', expected: 'complex' },
  { message: 'change the age field to a dropdown', expected: 'complex' },
  { message: 'convert the country field into radio buttons', expected: 'complex' },
  { message: 'copy the email field to page 2', expected: 'complex' },
  { message: 'move the phone field to the Contact page', expected: 'complex' },
  { message: 'move the email field to page 2', expected: 'complex' },
  { message: 'copy this field to the last page', expected: 'complex' },
  // question — no edits expected
  { message: 'what field types do you support?', expected: 'question' },
  { message: 'How do conditions work?', expected: 'question' },
  { message: 'how do I add conditional logic?', expected: 'question' },
  { message: 'Can you explain what a hint is?', expected: 'question' },
  { message: 'do you support file uploads?', expected: 'question' },
  { message: "what's the difference between radio and checkbox?", expected: 'question' },
  { message: 'what are the available options for validation?', expected: 'question' },
];
