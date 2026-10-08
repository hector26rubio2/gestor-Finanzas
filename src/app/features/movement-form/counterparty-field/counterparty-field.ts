import { Component, Input, inject, signal, input } from '@angular/core';
import { ControlContainer, FormsModule, NgForm } from '@angular/forms';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { I18nService } from '@core/i18n';
import { P } from '@core/session/permissions';
import { AppStore, CAPABILITIES } from '@core/state/store';
import { CatalogCommands } from '@core/state/catalog-commands';
import { PersonKind } from '@core/state/view-model';
import { FieldComponent } from '@ui/field/field';
import { IconComponent } from '@ui/icon/icon';
import { UiOption, UiSelectComponent } from '@ui/select/select';
import { CounterpartyScope } from '@features/movement-form/movement-visibility-builder';

@Component({
  selector: 'fin-movement-counterparty-field',
  imports: [FormsModule, UiSelectComponent, FieldComponent, HlmButton, HlmInput, IconComponent],
  templateUrl: './counterparty-field.html',
  host: { style: 'display: contents' },
  viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
})
export class MovementCounterpartyFieldComponent {
  @Input({ required: true }) model!: Record<string, any>;
  readonly scope = input.required<CounterpartyScope>();

  private readonly store = inject(AppStore);

  private readonly catalogCommands = inject(CatalogCommands);
  private readonly caps = inject(CAPABILITIES);
  readonly i18n = inject(I18nService);
  readonly creando = signal(false);
  readonly nombreNuevo = signal('');
  readonly guardando = signal(false);

  label(): string {
    const op = this.model['operationType'];
    if (op === 'credit') return this.i18n.t('form.movement.counterparty.institution');
    if (op === 'received') return this.i18n.t('form.movement.counterparty.sender');
    return this.model['kind'] === 'income'
      ? this.i18n.t('form.movement.counterparty.lender')
      : this.i18n.t('form.movement.counterparty.borrower');
  }

  opciones(): readonly UiOption[] {
    const personas = this.store
      .data()
      .people.filter((persona) => {
        const scope = this.scope();
        return scope === 'any' || (persona.kind ?? 'person') === scope;
      })
      .map((persona) => ({
        value: persona.id,
        label:
          this.scope() === 'any' && persona.kind === 'institution'
            ? `${persona.name} · ${this.i18n.t('people.kind.institution')}`
            : persona.name,
      }));
    return [{ value: '', label: this.i18n.t('form.actions.select') }, ...personas];
  }

  puedeCrear(): boolean {
    return this.caps.allows(P.personas.crear);
  }

  private tipoNuevo(): PersonKind {
    return this.scope() === 'institution' ? 'institution' : 'person';
  }

  textoAgregar(): string {
    return this.i18n.t(
      this.tipoNuevo() === 'institution'
        ? 'form.movement.counterparty.addInstitution'
        : 'form.movement.counterparty.addPerson',
    );
  }

  async agregar(): Promise<void> {
    const nombre = this.nombreNuevo().trim();
    if (!nombre || this.guardando()) return;
    this.guardando.set(true);
    try {
      const creada = await this.catalogCommands.createCounterparty(nombre, this.tipoNuevo());
      this.model['counterpartyId'] = creada.id;
      this.nombreNuevo.set('');
      this.creando.set(false);
    } finally {
      this.guardando.set(false);
    }
  }
}
