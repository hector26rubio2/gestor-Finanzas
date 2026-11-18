import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_TRANSPORT } from '@core/http/api-http-client';
import { P } from '@core/session';
import { AppStore } from '@core/state';
import type { DeudaConPersona } from '@features/people/deudas';
import { PeopleStore } from '@features/people';
import { datosDe } from '@testing/datos-de-prueba';
import { sesionDe } from '@testing/sesion-de-prueba';
import { TransportFalso } from '@testing/transport-falso';
import { DebtPaymentComponent } from './debt-payment';

const DEUDA: DeudaConPersona = {
  id: 'deuda-1',
  personaId: 'p1',
  persona: 'Andrés',
  descripcion: 'Zapatos',
  direccion: 'owing',
  moneda: 'COP',
  valor: 300000,
  cuota: 50000,
  cuotaActual: 3,
  totalCuotas: 6,
  pendiente: 200000,
  tarjeta: null,
  pagos: 1,
  abonos: [],
  saldada: false,
};

const CUENTAS = [
  { id: 'cop-1', name: 'Ahorros', type: 'savings' as const, currency: 'COP', openingBalance: 0, isDefault: true },
  { id: 'usd-1', name: 'Dólares', type: 'savings' as const, currency: 'USD', openingBalance: 0 },
];

const PAGO = {
  obligation: { id: 'deuda-1' },
  movement: {
    id: 'mov-pago',
    date: '2026-11-18',
    kind: 6,
    effect: 2,
    flow: 1,
    amount: {
      original: { amount: '50000', currency: 'COP' },
      base: { amount: '50000', currency: 'COP' },
      rate: '1',
      rateAsOf: '2026-11-18',
    },
    links: { account: 'cop-1', obligation: 'deuda-1' },
    linkNames: {},
    reversalOf: null,
    reversedBy: null,
    purchaseApr: null,
    origin: 1,
    description: null,
    createdAt: '2026-11-18T10:00:00Z',
  },
};

function abrir(opciones: { cuentas?: typeof CUENTAS } = {}) {
  const transport = new TransportFalso().responder('POST /api/v1/obligations/deuda-1/payments', { body: PAGO });
  const recargar = vi.fn();
  window.__FINANZAS_CONFIG__ = { apiBaseUrl: 'https://api.prueba.test' };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: API_TRANSPORT, useValue: transport },
      { provide: PeopleStore, useValue: { deudas: signal([DEUDA]), recargar } },
    ],
  });
  const store = TestBed.inject(AppStore);
  sesionDe().conCapacidad(P.movimientos.pagos.crear).aplicarEn(store);
  datosDe({ accounts: opciones.cuentas ?? CUENTAS }).aplicarEn(store);
  store.form.set({ kind: 'debt-payment', targetId: 'deuda-1' });
  const fixture = TestBed.createComponent(DebtPaymentComponent);
  fixture.detectChanges();
  return { fixture, store, transport, recargar };
}

const cuerpo = () => document.body;

describe('formulario de abono a una deuda', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('propone la cuota como monto y la cuenta en la moneda de la deuda', async () => {
    const { fixture } = abrir();
    await fixture.whenStable();
    fixture.detectChanges();

    const componente = fixture.componentInstance;
    expect(componente.modelo().amount).toBe(50000);
    expect(componente.modelo().account).toBe('cop-1');
    expect(componente.accountOptions().map((o) => o.value)).toEqual(['cop-1']);
    expect(cuerpo().querySelector('[data-testid="abono-pendiente"]')?.textContent).toMatch(/200[.,]000/);
  });

  it('al guardar registra el abono, recarga las deudas, cierra y avisa', async () => {
    const { fixture, store, transport, recargar } = abrir();
    await fixture.whenStable();

    await fixture.componentInstance.save();

    expect(transport.peticiones.map((p) => `${p.method} ${p.path}`)).toEqual([
      'POST /api/v1/obligations/deuda-1/payments',
    ]);
    expect(transport.peticiones[0].body).toMatchObject({
      amount: { amount: '50000', currency: 'COP' },
      account: 'cop-1',
    });
    expect(recargar).toHaveBeenCalledOnce();
    expect(store.form()).toBeNull();
    expect(store.toast.texto()).toBeTruthy();
  });

  it('un abono mayor a lo pendiente no se envía', async () => {
    const { fixture, transport } = abrir();
    await fixture.whenStable();
    fixture.componentInstance.modelo.update((m) => ({ ...m, amount: 250000 }));
    fixture.componentInstance.formulario.amount().markAsTouched();
    fixture.detectChanges();

    expect(fixture.componentInstance.formulario.amount().errors()[0]?.kind).toBe('amountExceeds');
    expect(transport.peticiones).toEqual([]);
  });

  it('sin cuentas en la moneda de la deuda avisa y no deja guardar', async () => {
    const { fixture } = abrir({ cuentas: [CUENTAS[1]] });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(cuerpo().querySelector('[data-testid="abono-sin-cuentas"]')?.textContent).toContain('COP');
    const guardar = cuerpo().querySelector<HTMLButtonElement>('[data-tour="form-abono-guardar"]');
    expect(guardar?.disabled).toBe(true);
  });
});
