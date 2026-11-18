import { required, validate, type SchemaFn } from '@angular/forms/signals';

export interface DatosDeAbono {
  date: string;
  amount: number | null;
  account: string;
  note: string;
}

export function esquemaDeAbono(pendiente: () => number, traducir: (clave: string) => string): SchemaFn<DatosDeAbono> {
  return (campo) => {
    required(campo.date, { message: () => traducir('form.management.error.startRequired') });
    required(campo.account, { message: () => traducir('form.debtPayment.error.account') });
    validate(campo.amount, ({ value }) => {
      const importe = value() ?? 0;
      if (!(importe > 0)) return { kind: 'amountPositive', message: traducir('form.movement.error.amountPositive') };
      return importe > pendiente() + 0.005
        ? { kind: 'amountExceeds', message: traducir('form.debtPayment.error.exceeds') }
        : undefined;
    });
  };
}
