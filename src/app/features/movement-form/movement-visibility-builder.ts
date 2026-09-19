import { Account } from '../../core/state/demo-data';

/**
 * Qué campo se ve, y en qué estado, para una combinación concreta de tipo de
 * movimiento + cuenta elegida + si se está creando o editando.
 *
 * Antes esto vivía repartido en un `fieldVisible(key)` con un `switch` plano: cada
 * regla nueva era una rama más, sin ningún sitio que dijera todas las reglas juntas.
 * Aquí cada `with*` agrega una regla y el orden de llamada no importa — todas leen
 * del mismo contexto de entrada, nunca de lo que ya decidió otra.
 */
export interface MovementFieldVisibility {
  readonly showTargetAccount: boolean;
  readonly showCategory: boolean;
  readonly showPerson: boolean;
  readonly showRecurrence: boolean;
  readonly showInstallments: boolean;
  /** En falso, la cuota actual se ve pero no se puede tocar: nace en 1 al crear. */
  readonly installmentCurrentEditable: boolean;
  readonly showCurrency: boolean;
  readonly showLoan: boolean;
}

export class MovementVisibilityBuilder {
  private result: MovementFieldVisibility = {
    showTargetAccount: false,
    showCategory: false,
    showPerson: false,
    showRecurrence: false,
    showInstallments: false,
    installmentCurrentEditable: false,
    showCurrency: false,
    showLoan: false,
  };

  constructor(
    private readonly kind: string,
    private readonly account: Account | undefined,
    private readonly isEditing: boolean,
  ) {}

  private get isCreditAccount(): boolean {
    return this.account?.type === 'credit';
  }

  withTargetAccount(): this {
    this.result = { ...this.result, showTargetAccount: this.kind === 'transfer' || this.kind === 'advance' };
    return this;
  }

  /** No existe categoría neutra: un traslado o un pago de tarjeta no clasifica. */
  withCategory(): this {
    this.result = { ...this.result, showCategory: this.kind === 'expense' || this.kind === 'income' };
    return this;
  }

  /** Propio o a nombre de otro — independiente de con qué cuenta se pagó. */
  withPerson(): this {
    this.result = { ...this.result, showPerson: this.kind === 'expense' || this.kind === 'income' };
    return this;
  }

  withRecurrence(): this {
    this.result = { ...this.result, showRecurrence: this.kind === 'expense' };
    return this;
  }

  /**
   * Las cuotas son de la tarjeta, no del gasto en general. Y la cuota actual nace
   * fija en 1: una compra que se está registrando ahora no puede empezar en la cuota
   * 5 de 12, eso solo tiene sentido al revisar una compra que ya existe.
   */
  withInstallments(): this {
    const showInstallments = this.kind === 'expense' && this.isCreditAccount;
    this.result = {
      ...this.result,
      showInstallments,
      installmentCurrentEditable: showInstallments && this.isEditing,
    };
    return this;
  }

  /** Solo si la cuenta elegida está denominada en una moneda distinta a la propia. */
  withCurrency(): this {
    this.result = { ...this.result, showCurrency: this.kind === 'expense' && this.account?.currency === 'USD' };
    return this;
  }

  /**
   * Un préstamo formal (personal, hipotecario, de vehículo) es dinero propio
   * moviéndose. Una compra con tarjeta es una deuda con el banco, no con la persona
   * a la que se le hizo el favor — a esa se le sigue pudiendo atribuir la compra con
   * el campo `person`, que no depende de esta regla.
   */
  withLoan(): this {
    this.result = {
      ...this.result,
      showLoan: (this.kind === 'expense' || this.kind === 'income') && !this.isCreditAccount,
    };
    return this;
  }

  /** Todas las reglas de una vez, en el orden en que ya se leen de arriba a abajo. */
  withAll(): this {
    return this.withTargetAccount()
      .withCategory()
      .withPerson()
      .withRecurrence()
      .withInstallments()
      .withCurrency()
      .withLoan();
  }

  build(): MovementFieldVisibility {
    return this.result;
  }
}
