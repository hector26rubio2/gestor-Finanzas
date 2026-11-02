import { describe, expect, it } from 'vitest';
import type { Account } from '@core/state/view-model';
import { crearSaldos, mapaDesdeBootstrap, mapaDesdeTablero } from './saldos';

const cuenta = (id: string, type: Account['type'], openingBalance = 0): Account => ({
  id,
  name: id,
  type,
  currency: 'COP',
  openingBalance,
});

const ahorros = cuenta('a1', 'savings');
const efectivo = cuenta('a2', 'cash');
const visa = cuenta('t1', 'credit');
const master = cuenta('t2', 'credit');
const todas = [ahorros, efectivo, visa, master];

const dinero = (amount: string) => ({ amount, currency: 'COP' });
const enlace = (id: string) => ({ id, name: id });

const localFijo = (cuentaLocal: Account) => ({ a1: 100, a2: 50, t1: -300, t2: 20 })[cuentaLocal.id] ?? 0;

describe('adaptadores de saldos', () => {
  it('bootstrap y tablero con los mismos datos producen el mismo mapa', () => {
    const delBootstrap = mapaDesdeBootstrap({
      asOf: '2026-10-01',
      accounts: [
        { account: enlace('a1'), balance: dinero('1000'), asOf: '2026-10-01' },
        { account: enlace('a2'), balance: dinero('250'), asOf: '2026-10-01' },
      ],
      cards: [{ cardId: 't1', debt: dinero('400') }],
    });
    const delTablero = mapaDesdeTablero({
      accounts: [
        { account: enlace('a1'), balance: dinero('1000'), asOf: '2026-10-01' },
        { account: enlace('a2'), balance: dinero('250'), asOf: '2026-10-01' },
      ],
      cards: [{ card: enlace('t1'), debt: dinero('400'), availableCredit: dinero('0'), asOf: '2026-10-01' }],
    });
    expect([...delBootstrap!]).toEqual([...delTablero]);
    expect(delTablero.get('t1')).toBe(-400);
    expect(delTablero.get('a1')).toBe(1000);
  });

  it('un bootstrap sin saldos no produce mapa', () => {
    expect(mapaDesdeBootstrap(null)).toBeNull();
  });
});

describe('Saldos', () => {
  const delServidor = new Map([
    ['a1', 1000],
    ['a2', 250],
    ['t1', -400],
  ]);

  it('saldoDe prefiere el servidor y cae al cálculo local para cuentas fuera del mapa', () => {
    const saldos = crearSaldos({ cuentas: todas, delServidor, calculoLocal: localFijo, noConfirmado: false });
    expect(saldos.saldoDe(ahorros)).toBe(1000);
    expect(saldos.saldoDe(visa)).toBe(-400);
    expect(saldos.saldoDe(master)).toBe(20);
  });

  it('sin servidor todo sale del cálculo local', () => {
    const saldos = crearSaldos({ cuentas: todas, delServidor: null, calculoLocal: localFijo, noConfirmado: false });
    expect(saldos.saldoDe(ahorros)).toBe(100);
    expect(saldos.deudaDe(visa)).toBe(300);
  });

  it('deudaDe es lo que se debe en una tarjeta y nunca negativa', () => {
    const saldos = crearSaldos({ cuentas: todas, delServidor, calculoLocal: localFijo, noConfirmado: false });
    expect(saldos.deudaDe(visa)).toBe(400);
    expect(saldos.deudaDe(master)).toBe(0);
  });

  it('deudaDe de una cuenta que no es tarjeta es cero aunque esté en rojo', () => {
    const saldos = crearSaldos({
      cuentas: todas,
      delServidor: new Map([['a1', -50]]),
      calculoLocal: localFijo,
      noConfirmado: false,
    });
    expect(saldos.deudaDe(ahorros)).toBe(0);
  });

  it('disponible suma las cuentas que no son tarjeta y deudaTotal las tarjetas', () => {
    const saldos = crearSaldos({ cuentas: todas, delServidor, calculoLocal: localFijo, noConfirmado: false });
    expect(saldos.disponible()).toBe(1250);
    expect(saldos.deudaTotal()).toBe(400);
  });

  it('queda marcado como no confirmado cuando el refresco del servidor falló', () => {
    const confirmado = crearSaldos({ cuentas: todas, delServidor, calculoLocal: localFijo, noConfirmado: false });
    const dudoso = crearSaldos({ cuentas: todas, delServidor: null, calculoLocal: localFijo, noConfirmado: true });
    expect(confirmado.confirmado).toBe(true);
    expect(dudoso.confirmado).toBe(false);
    expect(dudoso.disponible()).toBe(150);
  });
});
