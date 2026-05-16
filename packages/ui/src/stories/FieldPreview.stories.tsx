import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { FieldPreview } from '../field-preview';
import {
  TextInputField, TextAreaField, EmailField, NumberField,
  SelectField, RadioField, CheckboxField, DateField,
  FileUploadField, RichTextFormField,
  FillableFormFieldValidation, TextFieldValidation,
} from '@dculus/types';

/* ── Helper to create minimal fields ── */
const validation = new FillableFormFieldValidation(false);
const requiredValidation = new FillableFormFieldValidation(true);
const textValidation = new TextFieldValidation(false);

const fields = {
  shortText: new TextInputField('f1', 'Short Text', '', '', '', 'Enter your answer', textValidation),
  longText:  new TextAreaField('f2', 'Long Text', '', '', 'Write as much as you like', 'Tell us your story…', textValidation),
  email:     new EmailField('f3', 'Email Address', '', '', '', 'you@example.com', validation),
  number:    new NumberField('f4', 'Rating (1-10)', '', '', '', '5', validation, 1, 10),
  dropdown:  new SelectField('f5', 'Preferred Plan', '', '', '', validation, ['Free', 'Starter', 'Advanced']),
  radio:     new RadioField('f6', 'How did you hear about us?', 'Word of mouth', '', '', validation, ['Google', 'Twitter / X', 'Word of mouth', 'Other']),
  checkbox:  new CheckboxField('f7', 'Features you care about', [], '', '', '', validation, ['Analytics', 'Collaboration', 'Custom domain', 'API access']),
  date:      new DateField('f8', 'Preferred start date', '', '', '', '', validation),
  fileUpload: new FileUploadField('f9', 'Attach supporting documents', '', '', validation, ['image/*', 'application/pdf'], 10, 3),
  richText:  new RichTextFormField('f10', '<h2><strong>Welcome</strong></h2><p>Thank you for filling out this form. Please answer all questions honestly.</p>'),
  required:  new TextInputField('f11', 'Required Field', '', '', '', 'This is required', new TextFieldValidation(true)),
  withHint:  new TextInputField('f12', 'Username', '', '', 'Must be unique and 3–20 characters', 'john_doe', textValidation),
};

const meta: Meta = {
  title: 'Form/FieldPreview',
  parameters: { layout: 'padded', backgrounds: { default: 'app' } },
};
export default meta;
type Story = StoryObj;

export const AllFieldTypes: Story = {
  render: () => (
    <div className="max-w-lg p-8 bg-white rounded-xl border border-[rgba(81,76,84,0.10)] space-y-6">
      <div className="pb-4 border-b border-[rgba(81,76,84,0.10)]">
        <h2 className="text-sm font-semibold text-[#3c323e]">All Field Types — Builder Preview</h2>
        <p className="text-xs text-[#655d67] mt-0.5">Disabled previews as shown in the form builder canvas</p>
      </div>
      {Object.entries(fields).map(([key, field]) => (
        <FieldPreview key={key} field={field} disabled={true} />
      ))}
    </div>
  ),
};

export const ShortText: Story = {
  render: () => (
    <div className="max-w-sm p-6 bg-white rounded-xl border border-[rgba(81,76,84,0.10)]">
      <FieldPreview field={fields.shortText} disabled={false} />
    </div>
  ),
};

export const Dropdown: Story = {
  render: () => (
    <div className="max-w-sm p-6 bg-white rounded-xl border border-[rgba(81,76,84,0.10)]">
      <FieldPreview field={fields.dropdown} disabled={false} />
    </div>
  ),
};

export const RadioButtons: Story = {
  render: () => (
    <div className="max-w-sm p-6 bg-white rounded-xl border border-[rgba(81,76,84,0.10)]">
      <FieldPreview field={fields.radio} disabled={false} />
    </div>
  ),
};

export const CheckboxList: Story = {
  render: () => (
    <div className="max-w-sm p-6 bg-white rounded-xl border border-[rgba(81,76,84,0.10)]">
      <FieldPreview field={fields.checkbox} disabled={false} />
    </div>
  ),
};

export const FileUpload: Story = {
  render: () => (
    <div className="max-w-sm p-6 bg-white rounded-xl border border-[rgba(81,76,84,0.10)]">
      <FieldPreview field={fields.fileUpload} disabled={false} />
    </div>
  ),
};

export const RichText: Story = {
  render: () => (
    <div className="max-w-lg p-6 bg-white rounded-xl border border-[rgba(81,76,84,0.10)]">
      <FieldPreview field={fields.richText} disabled={false} />
    </div>
  ),
};

export const RequiredField: Story = {
  render: () => (
    <div className="max-w-sm p-6 bg-white rounded-xl border border-[rgba(81,76,84,0.10)]">
      <FieldPreview field={fields.required} disabled={false} />
    </div>
  ),
};

export const WithHintText: Story = {
  render: () => (
    <div className="max-w-sm p-6 bg-white rounded-xl border border-[rgba(81,76,84,0.10)]">
      <FieldPreview field={fields.withHint} disabled={false} />
    </div>
  ),
};
