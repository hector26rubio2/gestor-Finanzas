import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceApiClient } from '@core/api';
import { TrmApi } from '@core/api/trm.api';
import { P, RUNTIME_CONFIG } from '@core/session';
import { type Account, AppStore, CatalogCommands } from '@core/state';
import { USUARIO_DE_PRUEBA } from '@testing/usuario-de-prueba';
import { AccountFormComponent } from './account-form';

async function abrirFormulario(accountType: 'credit' | 'savings', account?: Account) {
  window.__FINANZAS_CONFIG__ = { apiBaseUrl: 'http://api.test' };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'http://api.test' } },
      { provide: FinanceApiClient, useValue: { dashboard: vi.fn(() => of(null)) } },
      { provide: TrmApi, useValue: { today: () => of(4012.5) } },
    ],
  });
  const store = TestBed.inject(AppStore);
  store.user.set({
    ...USUARIO_DE_PRUEBA,
    capabilities: [P.cuentas.ver, P.cuentas.ahorro.crear, P.cuentas.tarjetas.crear, P.cuentas.tarjetas.editar],
  });
  store.form.set({ kind: 'account', accountType, account });
  const fixture = TestBed.createComponent(AccountFormComponent);
  if (!account) fixture.componentInstance.modelo.update((datos) => ({ ...datos, currency: 'USD' }));
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { vista: document.body, fixture };
}

describe('formulario de cuenta nueva', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('una tarjeta de crédito pide cupo, no saldo inicial ni TRM de apertura', async () => {
    const { vista } = await abrirFormulario('credit');

    expect(vista.querySelector('input[name="cuenta.opening"]')).toBeNull();
    expect(vista.querySelector('input[name="cuenta.exchangeRate"]')).toBeNull();
    expect(vista.querySelector('input[name="cuenta.limit"]')).not.toBeNull();
  });

  it('una cuenta de ahorros sí pide saldo inicial', async () => {
    const { vista } = await abrirFormulario('savings');

    expect(vista.querySelector('input[name="cuenta.opening"]')).not.toBeNull();
    expect(vista.querySelector('input[name="cuenta.limit"]')).toBeNull();
    expect(vista.querySelector('fin-select-or-create[data-campo="issuerId"]')).not.toBeNull();
  });

  async function escribir(fixture: ComponentFixture<AccountFormComponent>, nombre: string, valor: string) {
    const campo = document.body.querySelector<HTMLInputElement>(`input[name="cuenta.${nombre}"]`)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function enviar(fixture: ComponentFixture<AccountFormComponent>) {
    document.body.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('un nombre vacío muestra el error en el campo y no crea la cuenta', async () => {
    const { fixture } = await abrirFormulario('savings');
    const crear = vi.spyOn(TestBed.inject(CatalogCommands), 'createAccount');

    await escribir(fixture, 'name', '');
    await enviar(fixture);

    expect(crear).not.toHaveBeenCalled();
    const campo = document.body.querySelector<HTMLInputElement>('input[name="cuenta.name"]')!;
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(document.body.querySelector('[role=alert]')?.textContent).toContain('Escribe un nombre.');
  });

  it('los últimos cuatro dígitos incompletos bloquean el envío', async () => {
    const { fixture } = await abrirFormulario('savings');
    const crear = vi.spyOn(TestBed.inject(CatalogCommands), 'createAccount');

    await escribir(fixture, 'lastFour', '12');
    await enviar(fixture);

    expect(crear).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('deben ser cuatro números');
  });

  it('una tarjeta sin cupo no se envía y avisa en el campo del cupo', async () => {
    const { fixture } = await abrirFormulario('credit');
    const crear = vi.spyOn(TestBed.inject(CatalogCommands), 'createAccount');

    await escribir(fixture, 'limit', '0');
    await enviar(fixture);

    expect(crear).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('El límite de crédito debe ser mayor a 0.');
  });

  it('con los datos completos envía el nombre escrito', async () => {
    const { fixture } = await abrirFormulario('savings');
    const crear = vi.spyOn(TestBed.inject(CatalogCommands), 'createAccount').mockResolvedValue(undefined as never);

    await escribir(fixture, 'name', 'Fondo viaje');
    await escribir(fixture, 'lastFour', '4321');
    await enviar(fixture);

    expect(crear).toHaveBeenCalledOnce();
    expect(crear.mock.calls[0][0]).toBe('Fondo viaje');
    expect(crear.mock.calls[0][6]).toBe('4321');
  });

  it('una cuenta nueva en dolares se rellena con la TRM vigente, sin tasa fija', async () => {
    const { fixture } = await abrirFormulario('savings');

    expect(fixture.componentInstance.modelo().exchangeRate).toBe(4012.5);
    const campo = document.body.querySelector<HTMLInputElement>('input[name="cuenta.exchangeRate"]')!;
    expect(campo.value).toBe('4.012,5');
  });

  it('el saldo inicial muestra el separador de miles y guarda el número exacto', async () => {
    const { fixture } = await abrirFormulario('savings');

    await escribir(fixture, 'opening', '25000000');

    const campo = document.body.querySelector<HTMLInputElement>('input[name="cuenta.opening"]')!;
    expect(campo.value).toBe('25.000.000');
    expect(fixture.componentInstance.modelo().opening).toBe(25_000_000);
  });

  it('el cupo y la cuota de manejo muestran el separador y guardan el número exacto', async () => {
    const { fixture } = await abrirFormulario('credit');

    const cupo = document.body.querySelector<HTMLInputElement>('input[name="cuenta.limit"]')!;
    expect(cupo.value).toBe('5.000.000');
    await escribir(fixture, 'limit', '12500000');
    await escribir(fixture, 'monthlyFee', '29900');

    expect(cupo.value).toBe('12.500.000');
    expect(fixture.componentInstance.modelo().limit).toBe(12_500_000);
    expect(document.body.querySelector<HTMLInputElement>('input[name="cuenta.monthlyFee"]')!.value).toBe('29.900');
    expect(fixture.componentInstance.modelo().monthlyFee).toBe(29_900);
  });

  it('un cupo vacío no se envía y avisa en el campo del cupo', async () => {
    const { fixture } = await abrirFormulario('credit');
    const crear = vi.spyOn(TestBed.inject(CatalogCommands), 'createAccount');

    await escribir(fixture, 'limit', '');
    await enviar(fixture);

    expect(crear).not.toHaveBeenCalled();
    expect(fixture.componentInstance.modelo().limit).toBeNull();
    expect(document.body.textContent).toContain('El límite de crédito debe ser mayor a 0.');
  });

  it('el abono de prueba de una tarjeta editada usa el separador y simula con el número exacto', async () => {
    const tarjeta: Account = {
      id: 't1',
      name: 'Visa',
      type: 'credit',
      currency: 'COP',
      openingBalance: 0,
      limit: 2000000,
      cutDay: 10,
      dueDay: 25,
      annualRate: 30,
      lastFour: '9999',
    };
    const { fixture } = await abrirFormulario('credit', tarjeta);

    await escribir(fixture, 'abonoDePrueba', '1500000');

    const campo = document.body.querySelector<HTMLInputElement>('input[name="cuenta.abonoDePrueba"]')!;
    expect(campo.value).toBe('1.500.000');
    expect(fixture.componentInstance.abonoDePrueba()).toBe(1_500_000);
  });

  it('al editar una tarjeta carga sus datos y guarda los cambios', async () => {
    const tarjeta: Account = {
      id: 't1',
      name: 'Visa',
      type: 'credit',
      currency: 'COP',
      openingBalance: 0,
      limit: 2000000,
      cutDay: 10,
      dueDay: 25,
      annualRate: 30,
      lastFour: '9999',
      dualCurrency: true,
      paymentPriority: [3, 1],
    };
    const { fixture } = await abrirFormulario('credit', tarjeta);
    const actualizar = vi.spyOn(TestBed.inject(CatalogCommands), 'updateAccount').mockResolvedValue(undefined);
    const componente = fixture.componentInstance;

    expect(componente.bimoneda()).toBe(true);
    expect(componente.paymentPriorityOrder().slice(0, 2)).toEqual([3, 1]);
    expect(componente.modelo()).toMatchObject({
      name: 'Visa',
      limit: 2000000,
      cutDay: 10,
      dueDay: 25,
      lastFour: '9999',
    });

    await escribir(fixture, 'name', 'Visa Oro');
    await enviar(fixture);

    expect(actualizar).toHaveBeenCalledOnce();
    expect(actualizar.mock.calls[0][1]).toMatchObject({ name: 'Visa Oro', credit: { cutDay: 10, dualCurrency: true } });
  });

  it('sin orden de prioridad oculta la lista y guarda que paga la deuda más vieja', async () => {
    const tarjeta: Account = {
      id: 't1',
      name: 'Visa',
      type: 'credit',
      currency: 'COP',
      openingBalance: 0,
      limit: 2000000,
      cutDay: 10,
      dueDay: 25,
      annualRate: 30,
    };
    const { fixture, vista } = await abrirFormulario('credit', tarjeta);
    const actualizar = vi.spyOn(TestBed.inject(CatalogCommands), 'updateAccount').mockResolvedValue(undefined);
    const componente = fixture.componentInstance;
    const lista = () => vista.querySelector('ol[aria-label]');

    expect(componente.aplicarPrioridad()).toBe(true);
    expect(lista()).not.toBeNull();

    componente.aplicarPrioridad.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(lista()).toBeNull();

    await enviar(fixture);
    expect(actualizar.mock.calls[0][1]).toMatchObject({ credit: { applyPaymentPriority: false } });
  });
});

describe('formulario de cuenta al vuelo', () => {
  beforeEach(() => TestBed.resetTestingModule());

  async function abrirAlVuelo(entradas: Record<string, unknown>) {
    window.__FINANZAS_CONFIG__ = { apiBaseUrl: 'http://api.test' };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'http://api.test' } },
        { provide: FinanceApiClient, useValue: { dashboard: vi.fn(() => of(null)) } },
        { provide: TrmApi, useValue: { today: () => of(4012.5) } },
      ],
    });
    const store = TestBed.inject(AppStore);
    store.user.set({
      ...USUARIO_DE_PRUEBA,
      capabilities: [
        P.cuentas.ver,
        P.cuentas.crear,
        P.cuentas.ahorro.crear,
        P.cuentas.efectivo.crear,
        P.cuentas.tarjetas.crear,
      ],
    });
    store.form.set({ kind: 'expense' });
    const fixture = TestBed.createComponent(AccountFormComponent);
    fixture.componentRef.setInput('modo', 'al-vuelo');
    for (const [nombre, valor] of Object.entries(entradas)) fixture.componentRef.setInput(nombre, valor);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, store };
  }

  it('arranca con el tipo y la moneda sugeridos', async () => {
    const { fixture } = await abrirAlVuelo({ tipoSugerido: 'credit', monedaSugerida: 'USD' });

    expect(fixture.componentInstance.modelo().type).toBe('credit');
    expect(fixture.componentInstance.modelo().currency).toBe('USD');
    expect(document.body.querySelector('input[name="cuenta.limit"]')).not.toBeNull();
  });

  it('solo ofrece los tipos admitidos que el permiso habilita', async () => {
    const { fixture } = await abrirAlVuelo({ tiposAdmitidos: ['cash', 'wallet', 'credit'] });

    expect(fixture.componentInstance.accountTypes().map((tipo) => tipo.value)).toEqual(['cash', 'wallet', 'credit']);
  });

  it('al guardar emite la cuenta creada, no navega y deja intacto el formulario del movimiento', async () => {
    const { fixture, store } = await abrirAlVuelo({ tipoSugerido: 'cash' });
    const creada: Account = { id: 'nueva', name: 'Billetera', type: 'cash', currency: 'COP', openingBalance: 0 };
    vi.spyOn(TestBed.inject(CatalogCommands), 'createAccount').mockResolvedValue(creada);
    const emitidas: Account[] = [];
    fixture.componentInstance.creada.subscribe((cuenta) => emitidas.push(cuenta));
    for (const [nombre, valor] of [
      ['name', 'Billetera'],
      ['lastFour', '4321'],
    ]) {
      const campo = document.body.querySelector<HTMLInputElement>(`input[name="cuenta.${nombre}"]`)!;
      campo.value = valor;
      campo.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      await fixture.whenStable();
    }

    document.body.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await vi.waitFor(() => expect(emitidas).toEqual([creada]));
    expect(store.form()?.kind).toBe('expense');
  });

  it('cancelar emite la cancelación sin tocar el formulario del movimiento', async () => {
    const { fixture, store } = await abrirAlVuelo({});
    let canceladas = 0;
    fixture.componentInstance.cancelada.subscribe(() => (canceladas += 1));

    fixture.componentInstance.closed();

    expect(canceladas).toBe(1);
    expect(store.form()?.kind).toBe('expense');
  });
});
