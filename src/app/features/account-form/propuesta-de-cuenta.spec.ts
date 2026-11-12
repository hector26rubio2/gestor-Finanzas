import { describe, expect, it } from 'vitest';
import { P } from '@core/session/permissions';
import { propuestaDeCuenta, type ContextoDeCuenta } from './propuesta-de-cuenta';

const TODOS = [P.cuentas.crear, P.cuentas.ahorro.crear, P.cuentas.efectivo.crear, P.cuentas.tarjetas.crear];

function contexto(cambios: Partial<ContextoDeCuenta> & { permisos?: readonly string[] }): ContextoDeCuenta {
  const { permisos = TODOS, ...resto } = cambios;
  return {
    destino: 'origen',
    kind: 'expense',
    operation: 'normal',
    permite: (permiso) => permisos.includes(permiso),
    ...resto,
  };
}

describe('propuestaDeCuenta', () => {
  it('un gasto normal ofrece cuentas y tarjeta, sugiriendo ahorros', () => {
    const propuesta = propuestaDeCuenta(contexto({ permisos: [...TODOS, P.movimientos.creditos.crear] }));

    expect(propuesta?.tipos).toEqual(['savings', 'checking', 'cash', 'wallet', 'other', 'credit']);
    expect(propuesta?.tipoSugerido).toBe('savings');
  });

  it('un avance solo ofrece tarjeta y la sugiere', () => {
    const propuesta = propuestaDeCuenta(contexto({ operation: 'advance' }));

    expect(propuesta?.tipos).toEqual(['credit']);
    expect(propuesta?.tipoSugerido).toBe('credit');
  });

  it('sin cuentas.tarjetas.crear no se ofrece tarjeta ni el «+» de un avance', () => {
    const sinTarjetas = TODOS.filter((permiso) => permiso !== P.cuentas.tarjetas.crear);

    expect(propuestaDeCuenta(contexto({ operation: 'advance', permisos: sinTarjetas }))).toBeNull();
    expect(
      propuestaDeCuenta(contexto({ permisos: [...sinTarjetas, P.movimientos.creditos.crear] }))?.tipos,
    ).not.toContain('credit');
  });

  it('solo ofrece los tipos que el permiso de ahorro o de efectivo habilita', () => {
    const soloEfectivo = [P.cuentas.crear, P.cuentas.efectivo.crear];
    const soloAhorro = [P.cuentas.crear, P.cuentas.ahorro.crear];

    expect(propuestaDeCuenta(contexto({ permisos: soloEfectivo }))?.tipos).toEqual(['cash', 'wallet', 'other']);
    expect(propuestaDeCuenta(contexto({ permisos: soloAhorro }))?.tipos).toEqual(['savings', 'checking', 'other']);
  });

  it('sin cuentas.crear no hay «+» de cuenta', () => {
    expect(propuestaDeCuenta(contexto({ permisos: [P.cuentas.ahorro.crear] }))).toBeNull();
  });

  it('la cuenta destino nunca es tarjeta y hereda la moneda del origen en una transferencia', () => {
    const propuesta = propuestaDeCuenta(
      contexto({ destino: 'destino', operation: 'transfer', monedaDelMovimiento: 'USD' }),
    );

    expect(propuesta?.tipos).not.toContain('credit');
    expect(propuesta?.monedaSugerida).toBe('USD');
  });

  it('la cuenta de origen toma la moneda del movimiento cuando es dólar', () => {
    expect(propuestaDeCuenta(contexto({ monedaDelMovimiento: 'USD' }))?.monedaSugerida).toBe('USD');
    expect(propuestaDeCuenta(contexto({}))?.monedaSugerida).toBeNull();
  });

  it('una moneda desconocida no se sugiere', () => {
    expect(propuestaDeCuenta(contexto({ monedaDelMovimiento: 'EUR' }))?.monedaSugerida).toBeNull();
  });

  it('un ingreso no ofrece tarjeta como cuenta de depósito', () => {
    const propuesta = propuestaDeCuenta(
      contexto({ kind: 'income', permisos: [...TODOS, P.movimientos.creditos.crear] }),
    );

    expect(propuesta?.tipos).not.toContain('credit');
  });
});
