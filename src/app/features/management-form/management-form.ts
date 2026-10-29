import { DateFieldComponent } from '@ui/date-field';
import { todayIso } from '@core/utils/dates';
import { IconComponent } from '@ui/icon';
import { IconPickerComponent } from '@ui/icon-picker';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { Component, computed, inject, signal } from '@angular/core';
import { FormField, FormRoot, form, type FieldTree } from '@angular/forms/signals';
import { I18nService } from '@core/i18n';
import { P } from '@core/session';
import { CAPABILITIES, AppStore, PersonKind, CatalogCommands } from '@core/state';
import { OverlayComponent } from '@ui/overlay';
import { UiOption, UiSelectComponent } from '@ui/select';
import { NumericInputDirective } from '@ui/numeric-input';
import { FieldComponent } from '@ui/field';
import { SegmentedComponent, SegmentedOption } from '@ui/segmented';
import { type DatosDeGestion, esquemaDeGestion } from './management-form.schema';

const RIESGOS_NUMERICOS = { Bajo: 1, Medio: 2, Alto: 3 } as const;

@Component({
  selector: 'fin-management-form',
  imports: [
    IconPickerComponent,
    IconComponent,
    DateFieldComponent,
    HlmButton,
    HlmInput,
    FormField,
    FormRoot,
    OverlayComponent,
    UiSelectComponent,
    NumericInputDirective,
    FieldComponent,
    SegmentedComponent,
  ],
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
  readonly modelo = signal<DatosDeGestion>({
    name: '',
    color: '#4f46e5',
    categoryType: 'expense',
    email: '',
    relationship: 'Otro',
    personKind: (this.store.form()?.personKind as PersonKind | undefined) ?? 'person',
    instrument: 'CDT',
    risk: '2',
    symbol: '',
    institution: '',
    currency: 'COP',
    amount: null,
    accountId: '',
    frequency: '3',
    start: todayIso(),
  });
  readonly formulario = form(
    this.modelo,
    esquemaDeGestion({
      traducir: (clave) => this.i18n.t(clave),
      esRecurrencia: () => this.kind() === 'recurrence',
      esPersona: () => this.kind() === 'person',
      cuentaValida: (id) => !!this.store.account(id),
    }),
    { name: 'gestion', submission: { action: async () => this.save() } },
  );
  icon = 'tag';
  readonly categoryTypeOptions = computed<readonly UiOption[]>(() => [
    { value: 'expense', label: this.i18n.t('form.management.categoryType.expense') },
    { value: 'income', label: this.i18n.t('form.management.categoryType.income') },
  ]);
  readonly personKindOptions = computed<readonly SegmentedOption[]>(() => [
    { value: 'person', label: this.i18n.t('people.kind.person'), icon: 'users' },
    { value: 'institution', label: this.i18n.t('people.kind.institution'), icon: 'bank' },
  ]);

  elegirTipoDePersona(valor: string): void {
    const personKind = valor === 'institution' ? 'institution' : 'person';
    this.modelo.update((datos) => ({ ...datos, personKind }));
  }

  mensaje(campo: FieldTree<unknown>): string {
    const estado = campo();
    return estado.touched() ? (estado.errors()[0]?.message ?? '') : '';
  }

  private correoDePersona(): string {
    const { personKind, email } = this.modelo();
    return personKind === 'person' ? email : '';
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
  readonly riskOptions = computed<readonly UiOption[]>(() => [
    { value: '1', label: this.i18n.t('form.management.risk.low') },
    { value: '2', label: this.i18n.t('form.management.risk.medium') },
    { value: '3', label: this.i18n.t('form.management.risk.high') },
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

  constructor() {
    const id = this.editingId;
    if (!id) return;
    const kind = this.kind();
    if (kind === 'category') {
      const category = this.store.categories().find((item) => item.id === id);
      if (!category) return;
      this.icon = category.icon;
      this.modelo.update((datos) => ({
        ...datos,
        name: category.name,
        color: category.color,
        categoryType: category.type === 1 ? 'income' : 'expense',
      }));
    }
    if (kind === 'person') {
      const person = this.store.data().people.find((item) => item.id === id);
      if (!person) return;
      this.modelo.update((datos) => ({
        ...datos,
        name: person.name,
        email: person.email ?? '',
        relationship: person.relationship ?? 'Otro',
        personKind: person.kind ?? 'person',
      }));
    }
    if (kind === 'investment') {
      const investment = this.store.data().investments.find((item) => item.id === id);
      if (!investment) return;
      this.modelo.update((datos) => ({
        ...datos,
        name: investment.name,
        instrument: investment.type,
        risk: String(RIESGOS_NUMERICOS[investment.risk ?? 'Medio']),
        symbol: investment.symbol ?? '',
        institution: investment.institution ?? '',
        currency: investment.currency,
      }));
    }
  }

  async save() {
    if (this.editingId) return this.saveChanges(this.editingId);
    const datos = this.modelo();
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
      if (this.kind() === 'category')
        await this.catalogCommands.createCategory(datos.name, datos.color, this.icon, datos.categoryType);
      if (this.kind() === 'person')
        await this.catalogCommands.createPerson(
          datos.name,
          this.correoDePersona(),
          datos.relationship,
          datos.personKind,
        );
      if (this.kind() === 'investment')
        await this.catalogCommands.createInvestment(datos.name, datos.instrument, datos.currency, {
          risk: Number(datos.risk),
          symbol: datos.symbol,
          institution: datos.institution,
        });
      if (this.kind() === 'recurrence')
        await this.catalogCommands.createRecurrence(
          datos.name,
          Number(datos.amount ?? 0),
          datos.accountId,
          Number(datos.frequency),
          datos.start,
        );
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : this.i18n.t('form.management.error.saveFailed'));
    }
  }

  private async saveChanges(id: string) {
    const datos = this.modelo();
    try {
      this.error.set('');
      const permisos: Record<string, string> = {
        category: P.cuentas.categorias.editar,
        person: P.personas.editar,
        investment: P.patrimonio.inversiones.editar,
      };
      const permiso = permisos[this.kind()];
      if (!permiso || !this.capabilities.allows(permiso)) throw new Error(this.i18n.t('form.error.forbidden'));
      if (!datos.name.trim()) throw new Error(this.i18n.t('form.management.error.nameRequired'));
      if (this.kind() === 'category')
        await this.catalogCommands.updateCategory(id, { name: datos.name, color: datos.color, icon: this.icon });
      if (this.kind() === 'person')
        await this.catalogCommands.updatePerson(id, {
          name: datos.name,
          email: this.correoDePersona(),
          relationship: datos.relationship,
          kind: datos.personKind,
        });
      if (this.kind() === 'investment')
        await this.catalogCommands.updateInvestment(id, {
          name: datos.name,
          instrumentType: datos.instrument,
          risk: Number(datos.risk),
          symbol: datos.symbol,
        });
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : this.i18n.t('form.management.error.saveFailed'));
    }
  }
}
