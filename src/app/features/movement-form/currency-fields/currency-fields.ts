import { HlmInput } from '@spartan-ng/helm/input';
import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlContainer, FormsModule, NgForm } from '@angular/forms';
import { I18nService } from '@core/i18n';
import { TrmApi } from '@core/api/trm.api';
import { NumericInputDirective } from '@ui/numeric-input/numeric-input.directive';
import { FieldComponent } from '@ui/field/field';

@Component({
  selector: 'fin-movement-currency-fields',
  imports: [HlmInput, FormsModule, NumericInputDirective, FieldComponent],
  templateUrl: './currency-fields.html',
  host: { style: 'display: contents' },
  viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
})
export class MovementCurrencyFieldsComponent implements OnInit {
  @Input({ required: true }) model!: Record<string, any>;
  readonly i18n = inject(I18nService);
  private readonly trmApi = inject(TrmApi);
  private readonly destroyRef = inject(DestroyRef);
  readonly officialTrm = signal<number | null>(null);
  readonly officialTrmLoading = signal(true);

  ngOnInit() {
    this.model['originalCurrency'] = 'USD';
    this.trmApi
      .today()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.officialTrm.set(value);
        this.officialTrmLoading.set(false);
      });
  }
}
