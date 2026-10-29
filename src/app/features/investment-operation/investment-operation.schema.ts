import { hidden, required, validate, type SchemaFn } from '@angular/forms/signals';

export interface DatosDeOperacion {
  type: string;
  date: string;
  amount: number | null;
  account: string;
  quantity: number | null;
  unitPrice: number | null;
  description: string;
}

const APORTE = '1';
const RETIRO = '2';
const COMPRA = '3';
const VENTA = '4';

export function esquemaDeOperacion(traducir: (clave: string) => string): SchemaFn<DatosDeOperacion> {
  return (campo) => {
    const falla = (kind: string, clave: string) => ({ kind, message: traducir(clave) });
    const positivo = (valor: number | null) => (valor ?? 0) > 0;
    const conCantidad = (tipo: string) => tipo === COMPRA || tipo === VENTA;

    required(campo.date, { message: () => traducir('form.management.error.startRequired') });
    validate(campo.amount, ({ value }) =>
      positivo(value()) ? undefined : falla('amountPositive', 'form.movement.error.amountPositive'),
    );
    validate(campo.account, ({ value, valueOf }) => {
      const tipo = valueOf(campo.type);
      return (tipo === APORTE || tipo === RETIRO) && !value()
        ? falla('accountRequired', 'form.investment.operation.error.accountRequired')
        : undefined;
    });

    hidden(campo.quantity, { when: ({ valueOf }) => !conCantidad(valueOf(campo.type)) });
    hidden(campo.unitPrice, { when: ({ valueOf }) => !conCantidad(valueOf(campo.type)) });
    validate(campo.quantity, ({ value }) =>
      positivo(value()) ? undefined : falla('quantity', 'form.investment.operation.error.quantity'),
    );
    validate(campo.unitPrice, ({ value }) =>
      positivo(value()) ? undefined : falla('unitPrice', 'form.investment.operation.error.unitPrice'),
    );
  };
}
