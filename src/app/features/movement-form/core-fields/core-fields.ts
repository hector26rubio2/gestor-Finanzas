import { DateFieldComponent } from '@ui/date-field/date-field';
import { HlmInput } from '@spartan-ng/helm/input';
import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { ControlContainer, FormsModule, NgForm } from '@angular/forms';
import { I18nService } from '@core/i18n';
import { P } from '@core/session/permissions';
import { CAPABILITIES, AppStore } from '@core/state/store';
import { Account } from '@core/state/view-model';
import { UiOption, UiSelectComponent } from '@ui/select/select';
import { NumericInputDirective } from '@ui/numeric-input/numeric-input.directive';
import { FieldComponent } from '@ui/field/field';

@Component({
  selector: 'fin-movement-core-fields',
  imports: [DateFieldComponent, HlmInput, FormsModule, UiSelectComponent, NumericInputDirective, FieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './core-fields.html',
  host: { style: 'display: contents' },
  viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
})
export class MovementCoreFieldsComponent {
  @Input({ required: true }) model!: Record<string, any>;
  @Input({ required: true }) kind!: string;
  @Input() operation = 'normal';
  @Input() showTargetAccount = false;

  private readonly store = inject(AppStore);
  private readonly caps = inject(CAPABILITIES);
  readonly i18n = inject(I18nService);

  private opcion(cuenta: Account): UiOption {
    return { value: cuenta.id, label: `${cuenta.name} · ${this.i18n.t(`form.account.type.${cuenta.type}`)}` };
  }

  private admiteTarjeta(): boolean {
    if (this.kind !== 'expense') return false;
    if (this.operation === 'advance') return this.caps.allows(P.movimientos.avances.crear);
    if (this.operation === 'normal' || this.operation === 'loan') return this.caps.allows(P.movimientos.creditos.crear);
    return false;
  }

  accountOptions(): readonly UiOption[] {
    const cuentas = this.store
      .data()
      .accounts.filter((cuenta) =>
        this.operation === 'advance' ? cuenta.type === 'credit' : cuenta.type !== 'credit' || this.admiteTarjeta(),
      );
    return [{ value: '', label: this.i18n.t('form.actions.select') }, ...cuentas.map((cuenta) => this.opcion(cuenta))];
  }

  targetAccountOptions(): readonly UiOption[] {
    return [
      { value: '', label: this.i18n.t('form.actions.select') },
      ...this.store
        .data()
        .accounts.filter((cuenta) => cuenta.type !== 'credit' && cuenta.id !== this.model['accountId'])
        .map((cuenta) => this.opcion(cuenta)),
    ];
  }

  sourceAccountLabel(): string {
    if (this.operation === 'advance') return this.i18n.t('form.movement.field.advanceCard');
    if (this.operation === 'transfer') return this.i18n.t('form.movement.field.sourceAccount');
    if (this.kind === 'income') return this.i18n.t('form.movement.field.depositAccount');
    if (this.operation === 'loan') return this.i18n.t('form.movement.field.loanSource');
    return this.i18n.t('form.movement.field.account');
  }

  targetAccountLabel(): string {
    return this.operation === 'advance'
      ? this.i18n.t('form.movement.field.advanceTarget')
      : this.i18n.t('form.movement.field.targetAccount');
  }
}
