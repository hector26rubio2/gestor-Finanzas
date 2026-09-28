import { ApiCategory } from '@core/api/api-client';
import { UiOption } from '@ui/select/select';

export const CATEGORY_TYPE_INCOME = 1;
export const CATEGORY_TYPE_EXPENSE = 2;

export function buildCategoryOptions(kind: string, categories: readonly ApiCategory[]): readonly UiOption[] {
  const wantedType = kind === 'income' ? CATEGORY_TYPE_INCOME : CATEGORY_TYPE_EXPENSE;
  return categories
    .filter((category) => category.isActive && category.type === wantedType)
    .map((category) => ({ value: category.name, label: category.name }));
}
