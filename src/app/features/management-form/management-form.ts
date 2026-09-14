import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../core/i18n';
import { P } from '../../core/permissions';
import { CAPABILITIES, DemoStore } from '../../core/store';
import { OverlayComponent } from '../../ui/ui';
import { UiOption, UiSelectComponent } from '../../ui/select';
import { NumericInputDirective } from '../../ui/numeric-input.directive';
import { FieldComponent } from '../../ui/field';

@Component({
  selector: 'demo-management-form',
  standalone: true,
  imports: [FormsModule, OverlayComponent, UiSelectComponent, NumericInputDirective, FieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './management-form.html',
  styleUrl: './management-form.css',
})
export class ManagementFormComponent {
  private readonly capabilities = inject(CAPABILITIES);
  readonly store = inject(DemoStore);
  readonly i18n = inject(I18nService);
  readonly error = signal('');
  readonly kind = computed(() => this.store.form()?.kind ?? 'category');
  readonly title = computed(
    () =>
      ({
        category: this.i18n.t('form.management.title.category'),
        person: this.i18n.t('form.management.title.person'),
        investment: this.i18n.t('form.management.title.investment'),
        recurrence: this.i18n.t('form.management.title.recurrence'),
      })[this.kind()] ?? this.i18n.t('form.management.title.default'),
  );
  name = '';
  color = '#4f46e5';
  icon = '●';
  categoryType: 'income' | 'expense' = 'expense';
  readonly categoryTypeOptions = computed<readonly UiOption[]>(() => [
    { value: 'expense', label: this.i18n.t('form.management.categoryType.expense') },
    { value: 'income', label: this.i18n.t('form.management.categoryType.income') },
  ]);
  email = '';
  relationship: import('../../core/demo-data').Person['relationship'] = 'Otro';
  readonly relationshipOptions = computed<readonly UiOption[]>(() => [
    { value: 'Familia', label: this.i18n.t('form.management.relationship.family') },
    { value: 'Amistad', label: this.i18n.t('form.management.relationship.friendship') },
    { value: 'Trabajo', label: this.i18n.t('form.management.relationship.work') },
    { value: 'Cliente', label: this.i18n.t('form.management.relationship.client') },
    { value: 'Proveedor', label: this.i18n.t('form.management.relationship.supplier') },
    { value: 'Otro', label: this.i18n.t('form.management.relationship.other') },
  ]);
  readonly instrumentOptions = computed<readonly UiOption[]>(() => [
    { value: 'CDT', label: this.i18n.t('form.management.instrument.cdt') },
    { value: 'Fondo', label: this.i18n.t('form.management.instrument.fund') },
    { value: 'Acción', label: this.i18n.t('form.management.instrument.stock') },
    { value: 'Criptoactivo', label: this.i18n.t('form.management.instrument.crypto') },
  ]);
  readonly currencyOptions = computed<readonly UiOption[]>(() => [
    { value: 'COP', label: this.i18n.t('form.currency.cop') },
    { value: 'USD', label: this.i18n.t('form.currency.usd') },
  ]);
  readonly frequencyOptions = computed<readonly UiOption[]>(() => [
    { value: '2', label: this.i18n.t('form.frequency.weekly') },
    { value: '3', label: this.i18n.t('form.frequency.monthly') },
    { value: '4', label: this.i18n.t('form.frequency.yearly') },
  ]);
  readonly accountOptions = computed<readonly UiOption[]>(() => [
    { value: '', label: this.i18n.t('form.actions.select') },
    ...this.store.data().accounts.map((account) => ({ value: account.id, label: account.name })),
  ]);
  instrument = 'CDT';
  currency = 'COP';
  amount = 0;
  accountId = '';
  frequency = '3';
  start = new Date().toISOString().slice(0, 10);
  async save() {
    try {
      this.error.set('');
      const permisos: Record<string, string> = {
        category: P.cuentas.categorias.crear,
        person: P.personas.crear,
        investment: P.patrimonio.inversiones.crear,
        recurrence: P.calendario.recurrencias.crear,
      };
      const permiso = permisos[this.kind()];
      if (permiso && !this.capabilities.allows(permiso)) throw new Error(this.i18n.t('form.error.forbidden'));
      if (!this.name.trim()) throw new Error(this.i18n.t('form.management.error.nameRequired'));
      if (this.kind() === 'category')
        await this.store.createCategory(this.name, this.color, this.icon, this.categoryType);
      if (this.kind() === 'person') await this.store.createPerson(this.name, this.email, this.relationship);
      if (this.kind() === 'investment') await this.store.createInvestment(this.name, this.instrument, this.currency);
      if (this.kind() === 'recurrence')
        await this.store.createRecurrence(
          this.name,
          Number(this.amount),
          this.accountId,
          Number(this.frequency),
          this.start,
        );
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : this.i18n.t('form.management.error.saveFailed'));
    }
  }
}
