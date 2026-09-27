import { ChangeDetectionStrategy, Component, Input, computed, inject } from '@angular/core';
import { ControlContainer, FormsModule, NgForm } from '@angular/forms';
import { I18nService } from '@core/i18n';
import { AppStore } from '@core/state';
import { FieldComponent } from '@ui/field';
import { UiOption, UiSelectComponent } from '@ui/select';

@Component({
  selector: 'fin-movement-attribution-field',
  imports: [FormsModule, UiSelectComponent, FieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fin-field [label]="i18n.t('form.movement.field.person')">
      <fin-select
        name="person"
        [(ngModel)]="model['person']"
        [options]="personOptions()"
        [ariaLabel]="i18n.t('form.movement.field.person')"
      />
    </fin-field>
  `,
  host: { style: 'display: contents' },
  viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
})
export class MovementAttributionFieldComponent {
  @Input({ required: true }) model!: Record<string, any>;

  private readonly store = inject(AppStore);
  readonly i18n = inject(I18nService);

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
}
