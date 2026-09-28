import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { ControlContainer, FormsModule, NgForm } from '@angular/forms';
import { I18nService } from '@core/i18n';
import { AppStore } from '@core/state/store';
import { UiOption, UiSelectComponent } from '@ui/select/select';
import { buildCategoryOptions } from '@features/movement-form/movement-category-options.factory';
import { FieldComponent } from '@ui/field/field';

@Component({
  selector: 'fin-movement-category-field',
  imports: [FormsModule, UiSelectComponent, FieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './category-field.html',
  host: { style: 'display: contents' },
  viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
})
export class MovementCategoryFieldComponent {
  @Input({ required: true }) model!: Record<string, any>;
  @Input({ required: true }) kind!: string;

  private readonly store = inject(AppStore);
  readonly i18n = inject(I18nService);

  categoryOptions(): readonly UiOption[] {
    return [
      { value: '', label: this.i18n.t('form.actions.select') },
      ...buildCategoryOptions(this.kind, this.store.categories()),
    ];
  }
}
