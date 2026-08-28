/**
 * Starter shapes for the empty state.
 *
 * Conditional logic has a blank-page problem: the old empty state offered a
 * dashed box, one sentence, and an "Add rule" button that dropped you into six
 * empty dropdowns with no indication of which combinations are useful. A recipe
 * pre-selects the *shape* — operator and action type — and, where it can, a
 * plausible trigger field, leaving the author to confirm the specifics.
 *
 * Recipes are pure data (no JSX, no translation) so they can be unit-tested and
 * so their labels stay in the locale files.
 */

import { ConditionOperator, FieldType, FormPage } from '@dculus/types';

export type RecipeId =
  | 'showFieldOnChoice'
  | 'hideFieldOnChoice'
  | 'requireWhenFilled'
  | 'skipPageOnAnswer';

export type RecipeActionType =
  | 'showField'
  | 'hideField'
  | 'requireField'
  | 'unrequireField'
  | 'hidePage'
  | 'skipToPage';

export interface LogicRecipe {
  id: RecipeId;
  operator: ConditionOperator;
  actionType: RecipeActionType;
  /** Field types that make a natural trigger for this recipe, best first. */
  preferredTriggerTypes: FieldType[];
  /** Recipes that act on a page are hidden on single-page forms. */
  requiresMultiplePages: boolean;
}

export const LOGIC_RECIPES: LogicRecipe[] = [
  {
    id: 'showFieldOnChoice',
    operator: 'equals',
    actionType: 'showField',
    preferredTriggerTypes: [
      FieldType.RADIO_FIELD,
      FieldType.SELECT_FIELD,
      FieldType.CHECKBOX_FIELD,
    ],
    requiresMultiplePages: false,
  },
  {
    id: 'hideFieldOnChoice',
    operator: 'equals',
    actionType: 'hideField',
    preferredTriggerTypes: [
      FieldType.RADIO_FIELD,
      FieldType.SELECT_FIELD,
      FieldType.CHECKBOX_FIELD,
    ],
    requiresMultiplePages: false,
  },
  {
    id: 'requireWhenFilled',
    operator: 'isFilled',
    actionType: 'requireField',
    preferredTriggerTypes: [
      FieldType.TEXT_INPUT_FIELD,
      FieldType.EMAIL_FIELD,
      FieldType.NUMBER_FIELD,
    ],
    requiresMultiplePages: false,
  },
  {
    id: 'skipPageOnAnswer',
    operator: 'equals',
    actionType: 'skipToPage',
    preferredTriggerTypes: [FieldType.RADIO_FIELD, FieldType.SELECT_FIELD],
    requiresMultiplePages: true,
  },
];

/** Recipes worth offering for this form's shape. */
export const availableRecipes = (pages: FormPage[]): LogicRecipe[] =>
  LOGIC_RECIPES.filter((recipe) => !recipe.requiresMultiplePages || pages.length > 1);

/**
 * Best trigger field for a recipe: the first field matching its preferred types,
 * in preference order, else nothing (the author picks).
 */
export const suggestTriggerFieldId = (
  recipe: LogicRecipe,
  pages: FormPage[]
): string | undefined => {
  const fields = pages.flatMap((page) => page.fields);
  for (const type of recipe.preferredTriggerTypes) {
    const match = fields.find((field) => field.type === type);
    if (match) return match.id;
  }
  return undefined;
};

/**
 * The draft seed a recipe produces. `isFilled`/`isEmpty` carry no value, matching
 * the evaluator's operator table.
 */
export const recipeToSeed = (recipe: LogicRecipe, pages: FormPage[]) => ({
  combinator: 'all' as const,
  terms: [
    {
      fieldId: suggestTriggerFieldId(recipe, pages) ?? '',
      operator: recipe.operator,
      ...(recipe.operator === 'isFilled' || recipe.operator === 'isEmpty'
        ? {}
        : { value: undefined }),
    },
  ],
  actions: [{ type: recipe.actionType, fieldIds: [] as string[], pageId: '' }],
});
