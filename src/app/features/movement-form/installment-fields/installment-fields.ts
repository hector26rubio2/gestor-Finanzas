import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { ControlContainer, FormsModule, NgForm } from '@angular/forms';
import { I18nService } from '../../../core/i18n';
import { FieldComponent } from '../../../ui/field/field';
import { AppStore } from '../../../core/state/store';
import { mensualDesdeAnual } from '../../../shared/utils/tasas';

@Component({
  selector: 'fin-movement-installment-fields',
  imports: [HlmButton, HlmInput, FormsModule, FieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './installment-fields.html',
  host: { style: 'display: contents' },
  viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
})
export class MovementInstallmentFieldsComponent {
  @Input({ required: true }) model!: Record<string, any>;
  @Input() currentEditable = false;
  readonly i18n = inject(I18nService);
  private readonly store = inject(AppStore);

  private card() {
    return this.store.account(this.model['accountId']);
  }

  cardMonthlyRate(): number | undefined {
    const anual = this.card()?.annualRate;
    return anual === undefined ? undefined : mensualDesdeAnual(anual);
  }

  monthlyRate(): number | null {
    return this.model['installmentRate'] ?? this.cardMonthlyRate() ?? null;
  }

  onMonthlyRateChange(value: number | null): void {
    this.model['installmentRate'] = value;
  }

  useCardRate(): void {
    this.model['installmentRate'] = undefined;
  }

  isOverridden(): boolean {
    return this.model['installmentRate'] !== undefined && this.model['installmentRate'] !== null;
  }
}
