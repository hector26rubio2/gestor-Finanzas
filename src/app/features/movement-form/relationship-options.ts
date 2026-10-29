import { I18nService } from '@core/i18n';
import { Person } from '@core/state/view-model';
import { UiOption } from '@ui/select/select';

export type Relationship = NonNullable<Person['relationship']>;

export const DEFAULT_RELATIONSHIP: Relationship = 'Otro';

export function relationshipOptions(i18n: I18nService): readonly UiOption[] {
  return [
    { value: 'Familia', label: i18n.t('form.management.relationship.family') },
    { value: 'Amistad', label: i18n.t('form.management.relationship.friendship') },
    { value: 'Trabajo', label: i18n.t('form.management.relationship.work') },
    { value: 'Cliente', label: i18n.t('form.management.relationship.client') },
    { value: 'Proveedor', label: i18n.t('form.management.relationship.supplier') },
    { value: 'Otro', label: i18n.t('form.management.relationship.other') },
  ];
}
