interface SchemaLike {
  pages?: Array<{ fields?: Array<{ id?: string; type?: string; deleted?: boolean }> }>;
}

/**
 * Whether `fieldId` is a live (not soft-deleted) email field of the form. An email plugin may only
 * take its recipient from such a field; any other answer is free text the respondent controls.
 */
export const isActiveEmailField = (schema: unknown, fieldId: string): boolean =>
  ((schema as SchemaLike | null)?.pages ?? []).some((page) =>
    (page.fields ?? []).some(
      (field) => field.id === fieldId && field.deleted !== true && String(field.type).toLowerCase() === 'email_field'
    )
  );
