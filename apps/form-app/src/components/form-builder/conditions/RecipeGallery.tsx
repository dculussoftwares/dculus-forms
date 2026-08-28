import React from 'react';
import { ArrowRight, Eye, EyeOff, GitBranch, Asterisk, SkipForward } from 'lucide-react';
import { FormPage } from '@dculus/types';
import { cn } from '@dculus/utils';
import { useTranslation } from '../../../hooks/useTranslation';
import { ACTION_TONE, actionToneClass } from './logicVisuals';
import { LogicRecipe, RecipeId, availableRecipes, recipeToSeed } from './logicRecipes';
import type { RuleDraftSeed } from './RuleInspector';

const RECIPE_ICON: Record<RecipeId, React.ElementType> = {
  showFieldOnChoice: Eye,
  hideFieldOnChoice: EyeOff,
  requireWhenFilled: Asterisk,
  skipPageOnAnswer: SkipForward,
};

interface RecipeGalleryProps {
  pages: FormPage[];
  canEdit: boolean;
  onPick: (seed: RuleDraftSeed) => void;
}

/**
 * The empty state, as a set of starting points rather than a dashed box.
 *
 * "No conditions yet" plus one sentence gave a first-time author nothing to act
 * on — conditional logic is genuinely hard to imagine in the abstract, and the
 * only next step offered was six blank dropdowns. Each card here names a concrete
 * pattern and opens the inspector with that shape (and a plausible trigger field)
 * already filled in.
 */
export const RecipeGallery: React.FC<RecipeGalleryProps> = ({ pages, canEdit, onPick }) => {
  const { t } = useTranslation('conditions');
  const recipes = availableRecipes(pages);

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-xl border border-dashed border-[var(--tf-border-strong)] py-10 text-center dark:border-gray-700">
        <GitBranch className="mx-auto h-7 w-7 text-[var(--tf-light-muted)]" />
        <h3 className="text-sm font-medium text-[var(--tf-dark)] dark:text-white">
          {t('empty.title')}
        </h3>
        <p className="mx-auto max-w-md px-4 text-xs text-[var(--tf-muted)] dark:text-gray-400">
          {t('empty.description')}
        </p>
      </div>

      {canEdit && recipes.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--tf-light-muted)] dark:text-gray-500">
            {t('recipes.title')}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {recipes.map((recipe: LogicRecipe) => {
              const Icon = RECIPE_ICON[recipe.id];
              return (
                <button
                  key={recipe.id}
                  type="button"
                  onClick={() => onPick(recipeToSeed(recipe, pages))}
                  data-testid={`logic-recipe-${recipe.id}`}
                  className="group flex items-start gap-2.5 rounded-xl border border-[var(--tf-border-medium)] bg-white p-3 text-left transition-colors hover:border-[var(--tf-border-strong)] hover:bg-[var(--tf-faint)] dark:border-gray-700 dark:bg-card dark:hover:bg-gray-800"
                >
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border',
                      actionToneClass(ACTION_TONE[recipe.actionType])
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-[var(--tf-dark)] dark:text-gray-100">
                      {t(`recipes.${recipe.id}.title`)}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-[var(--tf-muted)] dark:text-gray-400">
                      {t(`recipes.${recipe.id}.description`)}
                    </span>
                  </span>
                  <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--tf-light-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
