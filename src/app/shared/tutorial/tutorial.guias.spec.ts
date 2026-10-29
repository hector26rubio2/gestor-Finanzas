import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService } from '@core/i18n';
import { RUNTIME_CONFIG, P } from '@core/session';
import { AppStore, PreferencesActions } from '@core/state';
import { USUARIO_DE_PRUEBA } from '@testing/usuario-de-prueba';
import {
  CREAR_RECORRIDO,
  TutorialService,
  type CrearRecorrido,
  type NavegacionDelRecorrido,
  type PasoDelRecorrido,
} from './tutorial.service';

interface Captura {
  pasos: PasoDelRecorrido[];
  alCerrar: () => void;
  navegacion?: NavegacionDelRecorrido;
}

function montar(capacidades: string[] = [P.movimientos.crear]) {
  const capturas: Captura[] = [];
  const crear: CrearRecorrido = async (pasos, _textos, alCerrar, navegacion) => {
    capturas.push({ pasos, alCerrar, navegacion });
    return { arrancar: vi.fn() };
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'movements', children: [] },
        { path: 'dashboard', children: [] },
      ]),
      { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'http://api.test' } },
      { provide: CREAR_RECORRIDO, useValue: crear },
    ],
  });
  const store = TestBed.inject(AppStore);
  store.user.set({ ...USUARIO_DE_PRUEBA, capabilities: capacidades });
  store.featureFlags.set({ movements: true });
  store.featureFlagsLoaded.set(true);
  return { servicio: TestBed.inject(TutorialService), store, capturas };
}

function ponerVisible(tour: string): void {
  const elemento = document.createElement('div');
  elemento.dataset['tour'] = tour;
  elemento.getClientRects = () => [{}] as unknown as DOMRectList;
  document.body.appendChild(elemento);
}

describe('TutorialService: guías', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('iniciarGuia crea el recorrido con los pasos de la guía permitidos', async () => {
    const { servicio, capturas } = montar();
    await servicio.iniciarGuia('primeros-pasos');
    expect(capturas).toHaveLength(1);
    const selectores = capturas[0].pasos.map((paso) => paso.element);
    expect(selectores[0]).toBe('[data-tour="navegacion"]');
    expect(selectores).toContain('[data-tour="nuevo-movimiento"]');
  });

  it('iniciarGuia ignora una guía que la persona no puede ver', async () => {
    const { servicio, capturas } = montar([]);
    await servicio.iniciarGuia('gasto');
    await servicio.iniciarGuia('no-existe');
    expect(capturas).toHaveLength(0);
  });

  it('la guía de gasto abre el formulario, espera el campo y lo cierra al terminar', async () => {
    const { servicio, store, capturas } = montar();
    ponerVisible('form-tipo');
    await servicio.iniciarGuia('gasto');
    const { navegacion, alCerrar } = capturas[0];
    expect(await navegacion!.primero()).toBe(0);
    expect(store.form()).toMatchObject({ kind: 'expense', operationType: 'normal' });
    alCerrar();
    await vi.waitFor(() => expect(store.form()).toBeNull());
  });

  it('abre la tarjeta de crédito en la guía de compra con tarjeta', async () => {
    const { servicio, store, capturas } = montar();
    store.data.update((datos) => ({
      ...datos,
      accounts: [
        { id: 'a1', name: 'Ahorros', type: 'savings', currency: 'COP', openingBalance: 0 },
        { id: 't1', name: 'Visa', type: 'credit', currency: 'COP', openingBalance: 0 },
      ],
    }));
    ponerVisible('form-cuenta');
    await servicio.iniciarGuia('compra-tarjeta');
    await capturas[0].navegacion!.primero();
    expect(store.form()).toMatchObject({ kind: 'expense', accountId: 't1' });
    capturas[0].alCerrar();
  });

  it('marca la guía como completada solo si se llegó al final', async () => {
    const { servicio, capturas } = montar();
    ponerVisible('navegacion');
    await servicio.iniciarGuia('primeros-pasos');
    await capturas[0].navegacion!.primero();
    capturas[0].alCerrar();
    expect(servicio.completadas().has('primeros-pasos')).toBe(false);

    await servicio.iniciarGuia('primeros-pasos');
    const navegacion = capturas[1].navegacion!;
    await navegacion.primero();
    expect(await navegacion.siguiente(capturas[1].pasos.length - 1)).toBeNull();
    capturas[1].alCerrar();
    expect(servicio.completadas().has('primeros-pasos')).toBe(true);
    expect(localStorage.getItem(`finanzas.tutorial.completadas.${USUARIO_DE_PRUEBA.id}`)).toContain('primeros-pasos');
  });

  it('un localStorage que lanza no rompe las completadas', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    const { servicio } = montar();
    expect(servicio.completadas().size).toBe(0);
    expect(() => servicio.marcarCompletada('x')).not.toThrow();
  });

  it('abrir y cerrar el centro cambia su estado', () => {
    const { servicio } = montar();
    servicio.abrirCentro();
    expect(servicio.centroAbierto()).toBe(true);
    servicio.cerrarCentro();
    expect(servicio.centroAbierto()).toBe(false);
  });

  it('cambiarIdioma guarda la preferencia, recarga i18n y la persiste', async () => {
    const { servicio, store } = montar();
    const cargar = vi.spyOn(TestBed.inject(I18nService), 'load').mockResolvedValue();
    const persistir = vi.spyOn(TestBed.inject(PreferencesActions), 'persistPreferences').mockResolvedValue(undefined);
    await servicio.cambiarIdioma('en-US');
    expect(store.preferences().locale).toBe('en-US');
    expect(cargar).toHaveBeenCalledWith('en-US');
    expect(persistir).toHaveBeenCalledTimes(1);
  });

  it('si no se puede persistir el idioma avisa y mantiene el cambio local', async () => {
    const { servicio, store } = montar();
    vi.spyOn(TestBed.inject(I18nService), 'load').mockResolvedValue();
    vi.spyOn(TestBed.inject(PreferencesActions), 'persistPreferences').mockRejectedValue(new Error('sin red'));
    await servicio.cambiarIdioma('fr-FR');
    expect(store.preferences().locale).toBe('fr-FR');
    expect(store.toast.texto()).toBe('sin red');
  });
});
