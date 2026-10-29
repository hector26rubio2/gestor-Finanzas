import { required, validate, type SchemaFn } from '@angular/forms/signals';

export interface DatosDeValorizacion {
  date: string;
  value: number | null;
  source: string;
  reference: string;
}

export function esquemaDeValorizacion(traducir: (clave: string) => string): SchemaFn<DatosDeValorizacion> {
  return (campo) => {
    required(campo.date, { message: () => traducir('form.management.error.startRequired') });
    validate(campo.value, ({ value }) =>
      (value() ?? 0) > 0
        ? undefined
        : { kind: 'valuePositive', message: traducir('form.investment.valuation.error.value') },
    );
  };
}
