import { hidden, max, maxLength, min, pattern, required, type SchemaFn, type SchemaPath } from '@angular/forms/signals';
import type { AccountViewType } from '@core/api';

export type MonedaDePrioridad = 'pesos' | 'dolares';

export interface DatosDeCuenta {
  name: string;
  type: AccountViewType;
  currency: string;
  opening: number | null;
  lastFour: string;
  exchangeRate: number | null;
  issuerId: string;
  limit: number | null;
  cutDay: number | null;
  dueDay: number | null;
  monthlyRate: number | null;
  monthlyFee: number | null;
  monedaDePrioridad: MonedaDePrioridad;
  abonoDePrueba: number | null;
}

export type Traductor = (clave: string) => string;

export function esquemaDeCuenta(t: Traductor): SchemaFn<DatosDeCuenta> {
  return (campo) => {
    const mensaje = (clave: string) => ({ message: () => t(clave) });
    const soloCredito = (ruta: SchemaPath<number | null>) =>
      hidden(ruta, { when: ({ valueOf }) => valueOf(campo.type) !== 'credit' });

    required(campo.name, mensaje('form.error.nameRequired'));
    maxLength(campo.lastFour, 4, mensaje('form.account.error.lastFour'));
    pattern(campo.lastFour, /^\d{4}$/, mensaje('form.account.error.lastFour'));

    hidden(campo.opening, { when: ({ valueOf }) => valueOf(campo.type) === 'credit' });
    hidden(campo.exchangeRate, {
      when: ({ valueOf }) => valueOf(campo.currency) !== 'USD' || valueOf(campo.type) === 'credit',
    });
    soloCredito(campo.limit);
    soloCredito(campo.cutDay);
    soloCredito(campo.dueDay);
    soloCredito(campo.monthlyRate);
    soloCredito(campo.monthlyFee);

    required(campo.exchangeRate, mensaje('form.account.error.exchangeRate'));
    min(campo.exchangeRate, 1, mensaje('form.account.error.exchangeRate'));
    required(campo.limit, mensaje('form.account.error.creditLimit'));
    min(campo.limit, 1, mensaje('form.account.error.creditLimit'));
    for (const dia of [campo.cutDay, campo.dueDay]) {
      required(dia, mensaje('form.account.error.dayRange'));
      min(dia, 1, mensaje('form.account.error.dayRange'));
      max(dia, 31, mensaje('form.account.error.dayRange'));
    }
    min(campo.monthlyRate, 0, mensaje('form.movement.error.rateInvalid'));
    max(campo.monthlyRate, 100, mensaje('form.movement.error.rateInvalid'));
    min(campo.monthlyFee, 0, mensaje('form.account.error.monthlyFee'));
  };
}
