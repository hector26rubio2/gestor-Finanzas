import { Component, Input, computed, inject } from '@angular/core';
import { ControlContainer, FormsModule, NgForm } from '@angular/forms';
import { I18nService } from '../../core/i18n';
import { UiOption, UiSelectComponent } from '../../ui/select';
import { FieldComponent } from '../../ui/field';

@Component({
  selector: 'fin-movement-recurrence-fields',
  standalone: true,
  imports: [FormsModule, UiSelectComponent, FieldComponent],
  templateUrl: './movement-recurrence-fields.html',
  host: { style: 'display: contents' },
  viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
})
export class MovementRecurrenceFieldsComponent {
  @Input({ required: true }) model!: Record<string, any>;
  readonly i18n = inject(I18nService);

  readonly recurringOptions = computed<readonly UiOption[]>(() => [
    { value: '', label: this.i18n.t('form.actions.select') },
    { value: 'false', label: this.i18n.t('form.movement.recurring.no') },
    { value: 'true', label: this.i18n.t('form.movement.recurring.yes') },
  ]);

  readonly frequencyOptions = computed<readonly UiOption[]>(() => [
    { value: '', label: this.i18n.t('form.actions.select') },
    { value: 'weekly', label: this.i18n.t('form.frequency.weekly') },
    { value: 'monthly', label: this.i18n.t('form.frequency.monthly') },
    { value: 'yearly', label: this.i18n.t('form.frequency.yearly') },
  ]);
}
