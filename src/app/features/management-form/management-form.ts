import { DateFieldComponent } from '@ui/date-field';
import { IconComponent } from '@ui/icon';
import { IconPickerComponent } from '@ui/icon-picker';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '@core/i18n';
import { P } from '@core/session';
import { CAPABILITIES, AppStore, PersonKind, CatalogCommands } from '@core/state';
import { OverlayComponent } from '@ui/overlay';
import { UiOption, UiSelectComponent } from '@ui/select';
import { NumericInputDirective } from '@ui/numeric-input';
import { FieldComponent } from '@ui/field';
import { SegmentedComponent, SegmentedOption } from '@ui/segmented';

@Component({
  selector: 'fin-management-form',
  imports: [
    IconPickerComponent,
    IconComponent,
    DateFieldComponent,
    HlmButton,
    HlmInput,
    FormsModule,
    OverlayComponent,
    UiSelectComponent,
    NumericInputDirective,
    FieldComponent,
    SegmentedComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './management-form.html',
})
export class ManagementFormComponent {
  private readonly capabilities = inject(CAPABILITIES);
  readonly store = inject(AppStore);
  private readonly catalogCommands = inject(CatalogCommands);
  readonly i18n = inject(I18nService);
  readonly error = signal('');
  readonly kind = computed(() => this.store.form()?.kind ?? 'category');
  readonly editingId = this.store.form()?.targetId ?? null;
  readonly title = computed(() => {
    const titulos: Record<string, string> = this.editingId
      ? {
          category: this.i18n.t('form.management.title.editCategory'),
          person: this.i18n.t('form.management.title.editPerson'),
          investment: this.i18n.t('form.management.title.editInvestment'),
        }
      : {
          category: this.i18n.t('form.management.title.category'),
          person: this.i18n.t('form.management.title.person'),
          investment: this.i18n.t('form.management.title.investment'),
          recurrence: this.i18n.t('form.management.title.recurrence'),
        };
    return titulos[this.kind()] ?? this.i18n.t('form.management.title.default');
  });
  name = '';
  color = '#4f46e5';
  icon = 'tag';
  categoryType: 'income' | 'expense' = 'expense';
  readonly categoryTypeOptions = computed<readonly UiOption[]>(() => [
    { value: 'expense', label: this.i18n.t('form.management.categoryType.expense') },
    { value: 'income', label: this.i18n.t('form.management.categoryType.income') },
  ]);
  email = '';
  relationship: import('@core/state/view-model').Person['relationship'] = 'Otro';
  personKind: PersonKind = (this.store.form()?.personKind as PersonKind | undefined) ?? 'person';
  readonly personKindOptions = computed<readonly SegmentedOption[]>(() => [
    { value: 'person', label: this.i18n.t('people.kind.person'), icon: 'users' },
    { value: 'institution', label: this.i18n.t('people.kind.institution'), icon: 'bank' },
  ]);

  elegirTipoDePersona(valor: string): void {
    this.personKind = valor === 'institution' ? 'institution' : 'person';
  }

  private correoDePersona(): string {
    return this.personKind === 'person' ? this.email : '';
  }
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

  constructor() {
    const id = this.editingId;
    if (!id) return;
    const kind = this.kind();
    if (kind === 'category') {
      const category = this.store.categories().find((item) => item.id === id);
      if (!category) return;
      this.name = category.name;
      this.color = category.color;
      this.icon = category.icon;
      this.categoryType = category.type === 1 ? 'income' : 'expense';
    }
    if (kind === 'person') {
      const person = this.store.data().people.find((item) => item.id === id);
      if (!person) return;
      this.name = person.name;
      this.email = person.email ?? '';
      this.relationship = person.relationship ?? 'Otro';
      this.personKind = person.kind ?? 'person';
    }
    if (kind === 'investment') {
      const investment = this.store.data().investments.find((item) => item.id === id);
      if (!investment) return;
      this.name = investment.name;
      this.instrument = investment.type;
      this.currency = investment.currency;
    }
  }

  async save() {
    if (this.editingId) return this.saveChanges(this.editingId);
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
        await this.catalogCommands.createCategory(this.name, this.color, this.icon, this.categoryType);
      if (this.kind() === 'person')
        await this.catalogCommands.createPerson(this.name, this.correoDePersona(), this.relationship, this.personKind);
      if (this.kind() === 'investment')
        await this.catalogCommands.createInvestment(this.name, this.instrument, this.currency);
      if (this.kind() === 'recurrence')
        await this.catalogCommands.createRecurrence(
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

  private async saveChanges(id: string) {
    try {
      this.error.set('');
      const permisos: Record<string, string> = {
        category: P.cuentas.categorias.editar,
        person: P.personas.editar,
        investment: P.patrimonio.inversiones.editar,
      };
      const permiso = permisos[this.kind()];
      if (!permiso || !this.capabilities.allows(permiso)) throw new Error(this.i18n.t('form.error.forbidden'));
      if (!this.name.trim()) throw new Error(this.i18n.t('form.management.error.nameRequired'));
      if (this.kind() === 'category')
        await this.catalogCommands.updateCategory(id, { name: this.name, color: this.color, icon: this.icon });
      if (this.kind() === 'person')
        await this.catalogCommands.updatePerson(id, {
          name: this.name,
          email: this.correoDePersona(),
          relationship: this.relationship,
          kind: this.personKind,
        });
      if (this.kind() === 'investment')
        await this.catalogCommands.updateInvestment(id, { name: this.name, instrumentType: this.instrument });
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : this.i18n.t('form.management.error.saveFailed'));
    }
  }
}
