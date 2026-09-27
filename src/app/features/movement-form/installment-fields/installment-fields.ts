import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { ControlContainer, FormsModule, NgForm } from '@angular/forms';
import { I18nService } from '@core/i18n';
import { FieldComponent } from '@ui/field/field';
import { AppStore } from '@core/state/store';
import { mensualDesdeAnual } from '@shared/utils/tasas';
import { CARD_BUCKET, TIPOS_DE_COMPRA, claveDeConcepto } from '@core/api/card-buckets';
import { UiSelectComponent, type UiOption } from '@ui/select/select';

@Component({
  selector: 'fin-movement-installment-fields',
  imports: [HlmButton, HlmInput, FormsModule, FieldComponent, UiSelectComponent],
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

  tiposDeCompra(): UiOption[] {
    return [
      { value: '', label: this.i18n.t('form.movement.cardBucket.auto') },
      ...TIPOS_DE_COMPRA.map((tipo) => ({
        value: String(tipo),
        label: this.i18n.t(`card.bucket.${claveDeConcepto(tipo)}`),
      })),
    ];
  }

  tipoDeCompra(): string {
    return this.model['cardBucket'] ? String(this.model['cardBucket']) : '';
  }

  onTipoDeCompra(valor: string): void {
    const tipo = Number(valor) || undefined;
    this.model['cardBucket'] = tipo;
    if (tipo === CARD_BUCKET.zeroRatePurchases) this.model['installmentRate'] = 0;
    if (tipo === CARD_BUCKET.singleInstallmentPurchases) this.model['installmentTotal'] = 1;
    if (tipo === CARD_BUCKET.internationalPurchases && this.model['originalCurrency'] === 'COP')
      this.model['originalCurrency'] = 'USD';
  }

  isOverridden(): boolean {
    return this.model['installmentRate'] !== undefined && this.model['installmentRate'] !== null;
  }
}
