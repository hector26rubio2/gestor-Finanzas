import { Account } from '@core/state/view-model';

export type CounterpartyScope = 'person' | 'institution' | 'any';

export interface MovementFieldVisibility {
  readonly showTargetAccount: boolean;
  readonly showCategory: boolean;
  readonly showAttribution: boolean;
  readonly counterparty: CounterpartyScope | null;
  readonly showRecurrence: boolean;
  readonly showInstallments: boolean;
  readonly installmentCurrentEditable: boolean;
  readonly showCurrency: boolean;
  readonly showLoanTerms: boolean;
  readonly showLoanProduct: boolean;
  readonly showCardMode: boolean;
}

export class MovementVisibilityBuilder {
  private result: MovementFieldVisibility = {
    showTargetAccount: false,
    showCategory: false,
    showAttribution: false,
    counterparty: null,
    showRecurrence: false,
    showInstallments: false,
    installmentCurrentEditable: false,
    showCurrency: false,
    showLoanTerms: false,
    showLoanProduct: false,
    showCardMode: false,
  };

  constructor(
    private readonly kind: string,
    private readonly account: Account | undefined,
    private readonly isEditing: boolean,
    private readonly operationType: string = 'normal',
  ) {}

  private get isNormal(): boolean {
    return this.operationType === 'normal';
  }

  private get isCreditAccount(): boolean {
    return this.account?.type === 'credit';
  }

  withTargetAccount(): this {
    return this.set({ showTargetAccount: this.operationType === 'transfer' || this.operationType === 'advance' });
  }

  withCategory(): this {
    return this.set({
      showCategory: (this.isNormal && !!this.kind) || (this.kind === 'income' && this.operationType === 'received'),
    });
  }

  withAttribution(): this {
    return this.set({ showAttribution: this.isNormal && (this.kind === 'expense' || this.kind === 'income') });
  }

  withCounterparty(): this {
    const alcance: Record<string, CounterpartyScope> = { received: 'any', loan: 'person', credit: 'institution' };
    return this.set({ counterparty: alcance[this.operationType] ?? null });
  }

  withRecurrence(): this {
    return this.set({ showRecurrence: this.isNormal && this.kind === 'expense' });
  }

  withInstallments(): this {
    const compraConTarjeta = this.isNormal && this.kind === 'expense' && this.isCreditAccount;
    const showInstallments = compraConTarjeta || this.operationType === 'advance';
    return this.set({ showInstallments, installmentCurrentEditable: compraConTarjeta && this.isEditing });
  }

  withCurrency(): this {
    return this.set({ showCurrency: this.isNormal && this.kind === 'expense' && this.account?.currency === 'USD' });
  }

  withLoan(): this {
    const esFinanciacion = this.operationType === 'loan' || this.operationType === 'credit';
    return this.set({
      showLoanTerms: esFinanciacion,
      showLoanProduct: this.operationType === 'credit',
      showCardMode: this.operationType === 'loan' && this.kind === 'expense' && this.isCreditAccount,
    });
  }

  withAll(): this {
    return this.withTargetAccount()
      .withCategory()
      .withAttribution()
      .withCounterparty()
      .withRecurrence()
      .withInstallments()
      .withCurrency()
      .withLoan();
  }

  build(): MovementFieldVisibility {
    return this.result;
  }

  private set(cambios: Partial<MovementFieldVisibility>): this {
    this.result = { ...this.result, ...cambios };
    return this;
  }
}
