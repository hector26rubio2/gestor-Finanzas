import { email, hidden, required, validate, type SchemaFn } from '@angular/forms/signals';
import type { PersonKind } from '@core/state';
import type { Person } from '@core/state/view-model';

export interface DatosDeGestion {
  name: string;
  color: string;
  categoryType: 'income' | 'expense';
  email: string;
  relationship: NonNullable<Person['relationship']>;
  personKind: PersonKind;
  instrument: string;
  currency: string;
  amount: number | null;
  accountId: string;
  frequency: string;
  start: string;
}

export interface ReglasDeGestion {
  traducir: (clave: string) => string;
  esRecurrencia: () => boolean;
  esPersona: () => boolean;
  cuentaValida: (id: string) => boolean;
}

export function esquemaDeGestion(reglas: ReglasDeGestion): SchemaFn<DatosDeGestion> {
  return (campo) => {
    const mensaje = (clave: string) => ({ message: () => reglas.traducir(clave) });

    validate(campo.name, ({ value }) =>
      value().trim() ? undefined : { kind: 'required', message: reglas.traducir('form.management.error.nameRequired') },
    );

    hidden(campo.email, { when: ({ valueOf }) => !reglas.esPersona() || valueOf(campo.personKind) !== 'person' });
    email(campo.email, mensaje('form.management.error.emailInvalid'));

    const soloRecurrencia = { when: () => !reglas.esRecurrencia() };
    hidden(campo.amount, soloRecurrencia);
    hidden(campo.accountId, soloRecurrencia);
    hidden(campo.start, soloRecurrencia);
    validate(campo.amount, ({ value }) =>
      (value() ?? 0) > 0
        ? undefined
        : { kind: 'amountPositive', message: reglas.traducir('form.movement.error.amountPositive') },
    );
    validate(campo.accountId, ({ value }) =>
      reglas.cuentaValida(value())
        ? undefined
        : { kind: 'accountInvalid', message: reglas.traducir('form.recurrence.error.accountInvalid') },
    );
    required(campo.start, mensaje('form.management.error.startRequired'));
  };
}
