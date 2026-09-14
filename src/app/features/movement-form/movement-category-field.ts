import { Component, Input, inject } from '@angular/core';
import { ControlContainer, FormsModule, NgForm } from '@angular/forms';
import { I18nService } from '../../core/i18n';
import { DemoStore } from '../../core/store';
import { UiOption, UiSelectComponent } from '../../ui/select';
import { buildCategoryOptions } from './movement-category-options.factory';
import { FieldComponent } from '../../ui/field';

/**
 * Solo se muestra en gasto e ingreso — un traslado no clasifica, es la misma regla
 * que ya exige el backend (`CategoryTypeDto` no admite un valor neutro).
 */
@Component({
  selector: 'demo-movement-category-field',
  standalone: true,
  imports: [FormsModule, UiSelectComponent, FieldComponent],
  templateUrl: './movement-category-field.html',
  host: { style: 'display: contents' },
  viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
})
export class MovementCategoryFieldComponent {
  @Input({ required: true }) model!: Record<string, any>;
  @Input({ required: true }) kind!: string;

  private readonly store = inject(DemoStore);
  readonly i18n = inject(I18nService);

  // No es un `computed()`: `kind` es un `@Input()` normal que cambia sin recrear
  // este componente al alternar Gasto/Ingreso, y un `computed()` no lo rastrearía.
  categoryOptions(): readonly UiOption[] {
    return [
      { value: '', label: this.i18n.t('form.actions.select') },
      ...buildCategoryOptions(this.kind, this.store.categories()),
    ];
  }
}
