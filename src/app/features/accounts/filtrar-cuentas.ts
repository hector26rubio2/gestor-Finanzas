import type { Account } from '@core/state';

export function filtrarCuentas(
  cuentas: readonly Account[],
  texto: string,
  tipo: 'all' | Account['type'],
  locale: string,
): Account[] {
  const consulta = texto.trim().toLocaleLowerCase(locale);
  return cuentas.filter(
    (cuenta) =>
      (tipo === 'all' || cuenta.type === tipo) &&
      (!consulta ||
        cuenta.name.toLocaleLowerCase(locale).includes(consulta) ||
        (cuenta.lastFour ?? '').toLocaleLowerCase(locale).includes(consulta)),
  );
}
