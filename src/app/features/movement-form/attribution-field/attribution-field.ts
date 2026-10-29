import { Component, Input, computed, inject, signal } from '@angular/core';
import { ControlContainer, FormsModule, NgForm } from '@angular/forms';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { I18nService } from '@core/i18n';
import { P } from '@core/session/permissions';
import { CatalogCommands } from '@core/state/catalog-commands';
import { AppStore, CAPABILITIES } from '@core/state/store';
import { FieldComponent } from '@ui/field/field';
import { IconComponent } from '@ui/icon/icon';
import { UiOption, UiSelectComponent } from '@ui/select/select';
import { DEFAULT_RELATIONSHIP, Relationship, relationshipOptions } from '@features/movement-form/relationship-options';

@Component({
  selector: 'fin-movement-attribution-field',
  imports: [FormsModule, UiSelectComponent, FieldComponent, HlmButton, HlmInput, IconComponent],
  template: `
    <fin-field [label]="i18n.t('form.movement.field.person')">
      <div class="flex items-center gap-2">
        <fin-select
          class="min-w-0 flex-1"
          name="person"
          [(ngModel)]="model['person']"
          [options]="personOptions()"
          [ariaLabel]="i18n.t('form.movement.field.person')"
        />
        @if (puedeCrear()) {
          <button
            hlmBtn
            type="button"
            variant="outline"
            size="icon"
            [attr.aria-label]="i18n.t('form.movement.counterparty.addPerson')"
            [attr.aria-expanded]="creando()"
            (click)="creando.set(!creando())"
          >
            <fin-icon name="plus" />
          </button>
        }
      </div>
    </fin-field>
    @if (creando()) {
      <fin-field [label]="i18n.t('form.movement.counterparty.addPerson')">
        <div class="flex items-center gap-2">
          <input
            hlmInput
            class="min-w-0 flex-1"
            type="text"
            name="nuevaPersonaResponsable"
            [ngModel]="nombreNuevo()"
            (ngModelChange)="nombreNuevo.set($event)"
            (keydown.enter)="$event.preventDefault(); agregar()"
          />
          <fin-select
            class="w-40 shrink-0"
            name="relacionNuevaPersonaResponsable"
            [ngModel]="relacionNueva()"
            (ngModelChange)="relacionNueva.set($event)"
            [options]="relationshipOptions()"
            [ariaLabel]="i18n.t('form.management.field.relationship')"
          />
          <button hlmBtn type="button" size="sm" [disabled]="!nombreNuevo().trim() || guardando()" (click)="agregar()">
            {{ i18n.t('form.actions.add') }}
          </button>
        </div>
      </fin-field>
    }
  `,
  host: { style: 'display: contents' },
  viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
})
export class MovementAttributionFieldComponent {
  @Input({ required: true }) model!: Record<string, any>;

  private readonly store = inject(AppStore);
  private readonly catalogCommands = inject(CatalogCommands);
  private readonly caps = inject(CAPABILITIES);
  readonly i18n = inject(I18nService);
  readonly creando = signal(false);
  readonly nombreNuevo = signal('');
  readonly relacionNueva = signal<Relationship>(DEFAULT_RELATIONSHIP);
  readonly guardando = signal(false);
  readonly relationshipOptions = computed(() => relationshipOptions(this.i18n));

  readonly personOptions = computed<readonly UiOption[]>(() => [
    { value: '', label: this.i18n.t('form.movement.person.own') },
    ...this.store
      .data()
      .people.filter((persona) => persona.kind !== 'institution')
      .map((persona) => ({
        value: persona.name,
        label: this.i18n.t('form.movement.person.borrowed', { name: persona.name }),
      })),
  ]);

  puedeCrear(): boolean {
    return this.caps.allows(P.personas.crear);
  }

  async agregar(): Promise<void> {
    const nombre = this.nombreNuevo().trim();
    if (!nombre || this.guardando()) return;
    this.guardando.set(true);
    try {
      const creada = await this.catalogCommands.createCounterparty(nombre, 'person', undefined, this.relacionNueva());
      this.model['person'] = creada.name;
      this.nombreNuevo.set('');
      this.relacionNueva.set(DEFAULT_RELATIONSHIP);
      this.creando.set(false);
    } finally {
      this.guardando.set(false);
    }
  }
}
