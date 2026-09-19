import { ApiCategory } from '../../core/api/api-client';
import { UiOption } from '../../ui/select/select';

/**
 * Espejo de `Finanzas.Contracts.Categories.CategoryTypeDto`: no hay valor neutro
 * porque una categoría siempre pertenece a un solo lado del resultado.
 */
export const CATEGORY_TYPE_INCOME = 1;
export const CATEGORY_TYPE_EXPENSE = 2;

/**
 * Las categorías que puede elegir un movimiento, filtradas a las que de verdad
 * aplican a su tipo — antes la lista era fija y la misma para gasto e ingreso, así
 * que "Salario" aparecía como opción para clasificar un gasto.
 *
 * La categoría la crea quien administra: el filtro no adivina nada del nombre, lee
 * el tipo que se declaró al crearla.
 */
export function buildCategoryOptions(kind: string, categories: readonly ApiCategory[]): readonly UiOption[] {
  const wantedType = kind === 'income' ? CATEGORY_TYPE_INCOME : CATEGORY_TYPE_EXPENSE;
  return categories
    .filter((category) => category.isActive && category.type === wantedType)
    .map((category) => ({ value: category.name, label: category.name }));
}
