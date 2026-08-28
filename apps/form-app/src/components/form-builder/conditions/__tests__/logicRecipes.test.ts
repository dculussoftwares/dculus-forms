import { FieldType, FormPage } from '@dculus/types';
import { LOGIC_RECIPES, availableRecipes, recipeToSeed } from '../logicRecipes';

const makePage = (id: string, fields: Array<{ id: string; type: FieldType }>): FormPage =>
  ({ id, title: id, order: 0, fields } as unknown as FormPage);

const recipe = (id: string) => LOGIC_RECIPES.find((r) => r.id === id)!;

describe('recipeToSeed — operator must suit the trigger field', () => {
  // Checkbox triggers support only contains/notContains/isEmpty/isFilled. A
  // recipe seeding `equals` would open a draft that cannot be saved until the
  // author works out which dropdown is wrong.
  it('uses contains when the only choice field is a checkbox', () => {
    const pages = [makePage('p1', [{ id: 'cb', type: FieldType.CHECKBOX_FIELD }])];

    const seed = recipeToSeed(recipe('showFieldOnChoice'), pages);

    expect(seed.terms[0].fieldId).toBe('cb');
    expect(seed.terms[0].operator).toBe('contains');
  });

  it('keeps equals when the trigger is a radio field', () => {
    const pages = [makePage('p1', [{ id: 'radio', type: FieldType.RADIO_FIELD }])];

    const seed = recipeToSeed(recipe('showFieldOnChoice'), pages);

    expect(seed.terms[0].operator).toBe('equals');
  });

  // isFilled carries no value, so the seed must not add one.
  it('omits value for valueless operators', () => {
    const pages = [makePage('p1', [{ id: 'text', type: FieldType.TEXT_INPUT_FIELD }])];

    const seed = recipeToSeed(recipe('requireWhenFilled'), pages);

    expect(seed.terms[0].operator).toBe('isFilled');
    expect('value' in seed.terms[0]).toBe(false);
  });
});

describe('availableRecipes', () => {
  it('hides page-targeting recipes on a single-page form', () => {
    const ids = availableRecipes([makePage('p1', [])]).map((r) => r.id);

    expect(ids).not.toContain('skipPageOnAnswer');
  });

  it('offers them once the form has more than one page', () => {
    const ids = availableRecipes([makePage('p1', []), makePage('p2', [])]).map((r) => r.id);

    expect(ids).toContain('skipPageOnAnswer');
  });
});
