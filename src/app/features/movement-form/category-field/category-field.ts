import { Component, Input, inject, signal } from '@angular/core';
import { ControlContainer, FormsModule, NgForm } from '@angular/forms';
import { I18nService } from '@core/i18n';
import { AppStore } from '@core/state/store';
import { UiOption, UiSelectComponent } from '@ui/select/select';
import { buildCategoryOptions } from '@features/movement-form/movement-category-options.factory';
import { FieldComponent } from '@ui/field/field';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { IconComponent } from '@ui/icon/icon';
import { P } from '@core/session/permissions';
import { CAPABILITIES } from '@core/state/store';
import { CatalogCommands } from '@core/state/catalog-commands';

@Component({
  selector: 'fin-movement-category-field',
  imports: [FormsModule, UiSelectComponent, FieldComponent, HlmButton, HlmInput, IconComponent],
  templateUrl: './category-field.html',
  host: { style: 'display: contents' },
  viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
})
export class MovementCategoryFieldComponent {
  @Input({ required: true }) model!: Record<string, any>;
  @Input({ required: true }) kind!: string;

  private readonly store = inject(AppStore);
  readonly i18n = inject(I18nService);
  private readonly caps = inject(CAPABILITIES);
  private readonly catalogCommands = inject(CatalogCommands);
  readonly creando = signal(false);
  readonly nombreNuevo = signal('');
  readonly guardando = signal(false);

  puedeCrear(): boolean {
    return this.caps.allows(P.cuentas.categorias.crear);
  }

  async agregar(): Promise<void> {
    const nombre = this.nombreNuevo().trim();
    if (!nombre || this.guardando()) return;
    this.guardando.set(true);
    try {
      const creada = await this.catalogCommands.createCategoryInline(
        nombre,
        this.kind === 'income' ? 'income' : 'expense',
      );
      this.model['category'] = creada.name;
      this.nombreNuevo.set('');
      this.creando.set(false);
    } finally {
      this.guardando.set(false);
    }
  }

  categoryOptions(): readonly UiOption[] {
    return [
      { value: '', label: this.i18n.t('form.actions.select') },
      ...buildCategoryOptions(this.kind, this.store.categories()),
    ];
  }
}
