import React, { useMemo } from 'react';
import {
  CheckboxField,
  CheckboxFieldValidation,
  TextFieldValidation,
  TextInputField,
} from '@dculus/types';
import type { FormDesignTokens } from '@dculus/types';
import {
  Button,
  FieldPreview,
  FormThemeContext,
  buttonTokenClass,
  resolveFormTheme,
  useFormFonts,
} from '@dculus/ui';
import { cn } from '@dculus/utils';

interface BrandPreviewCardProps {
  tokens: FormDesignTokens | undefined;
  title: string;
  nameLabel: string;
  namePlaceholder: string;
  optionLabel: string;
  primaryLabel: string;
  secondaryLabel: string;
}

/**
 * Always-visible sample form (heading, input, checkbox, buttons) that renders the
 * current tokens with the same primitives and classes the viewer uses, so every
 * control in the drawer has an instant, unambiguous effect.
 */
export const BrandPreviewCard: React.FC<BrandPreviewCardProps> = ({
  tokens,
  title,
  nameLabel,
  namePlaceholder,
  optionLabel,
  primaryLabel,
  secondaryLabel,
}) => {
  useFormFonts(tokens);
  const theme = useMemo(() => resolveFormTheme(tokens, 'light'), [tokens]);

  const nameField = useMemo(
    () =>
      new TextInputField(
        'brand-preview-name',
        nameLabel,
        '',
        '',
        '',
        namePlaceholder,
        new TextFieldValidation(false)
      ),
    [nameLabel, namePlaceholder]
  );
  const optionField = useMemo(
    () =>
      new CheckboxField(
        'brand-preview-option',
        '',
        [optionLabel],
        '',
        '',
        '',
        new CheckboxFieldValidation(false),
        [optionLabel]
      ),
    [optionLabel]
  );

  return (
    <FormThemeContext.Provider value={theme}>
      <div
        data-testid="brand-preview-card"
        aria-hidden="true"
        className="space-y-3 rounded-xl border border-[var(--tf-border-medium)] bg-white p-4 text-gray-900"
        style={{
          ...theme.cssVars,
          ...(theme.hasSurface ? { backgroundColor: 'var(--df-surface)' } : null),
          ...(tokens?.bodyFont ? { fontFamily: 'var(--df-font-body)' } : null),
        }}
      >
        <h4
          className="text-base font-semibold"
          style={tokens?.headingFont ? { fontFamily: 'var(--df-font-heading)' } : undefined}
        >
          {title}
        </h4>
        <FieldPreview field={nameField} disabled />
        <FieldPreview field={optionField} disabled hideLabel />
        <div className="flex gap-2 pt-1">
          <Button type="button" tabIndex={-1} size="sm" className={buttonTokenClass(theme)}>
            {primaryLabel}
          </Button>
          <Button
            type="button"
            tabIndex={-1}
            size="sm"
            variant="ghost"
            className={cn('text-gray-600', theme.hasPrimary && 'text-[color:var(--df-primary)]')}
          >
            {secondaryLabel}
          </Button>
        </div>
      </div>
    </FormThemeContext.Provider>
  );
};

export default BrandPreviewCard;
