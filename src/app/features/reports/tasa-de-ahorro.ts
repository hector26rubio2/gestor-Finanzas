import { SIN_DATO } from '@shared/utils';

export function tasaDeAhorro(ingreso: number, neto: number): string {
  return ingreso ? `${Math.round((neto / ingreso) * 100)} %` : SIN_DATO;
}
