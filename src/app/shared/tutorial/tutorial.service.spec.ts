import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RUNTIME_CONFIG, P } from '@core/session';
import { AppStore } from '@core/state';
import { USUARIO_DE_PRUEBA } from '@testing/usuario-de-prueba';
import { CREAR_RECORRIDO, TutorialService, type CrearRecorrido, type PasoDelRecorrido } from './tutorial.service';

const CLAVE_VISTO = `finanzas.tutorial.visto.${USUARIO_DE_PRUEBA.id}`;
const CLAVE_AL_ENTRAR = 'finanzas.tutorial.al-entrar';

function montar() {
  const pasosRecibidos: PasoDelRecorrido[][] = [];
  const arrancar = vi.fn();
  const crear: CrearRecorrido = async (pasos) => {
    pasosRecibidos.push(pasos);
    return { arrancar };
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'http://api.test' } },
      { provide: CREAR_RECORRIDO, useValue: crear },
    ],
  });
  TestBed.inject(AppStore).user.set({ ...USUARIO_DE_PRUEBA, capabilities: [P.movimientos.crear] });
  return { servicio: TestBed.inject(TutorialService), pasosRecibidos, arrancar };
}

describe('TutorialService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('iniciar solo pasa al recorrido los pasos cuyo selector existe', async () => {
    const { servicio, pasosRecibidos, arrancar } = montar();
    document.body.innerHTML = '<nav data-tour="navegacion"></nav><button data-tour="perfil"></button>';
    await servicio.iniciar('desconocida');
    expect(pasosRecibidos).toHaveLength(1);
    expect(pasosRecibidos[0].map((paso) => paso.element)).toEqual(['[data-tour="navegacion"]', '[data-tour="perfil"]']);
    expect(arrancar).toHaveBeenCalledTimes(1);
  });

  it('sin ningún elemento presente no crea el recorrido', async () => {
    const { servicio, pasosRecibidos } = montar();
    await servicio.iniciar('dashboard');
    expect(pasosRecibidos).toHaveLength(0);
  });

  it('por defecto usa la sección de la ruta actual', async () => {
    const { servicio, pasosRecibidos } = montar();
    vi.spyOn(TestBed.inject(Router), 'url', 'get').mockReturnValue('/movements?pagina=2');
    document.body.innerHTML = '<div data-tour="movimientos-kpis"></div>';
    await servicio.iniciar();
    expect(pasosRecibidos[0].map((paso) => paso.element)).toEqual(['[data-tour="movimientos-kpis"]']);
  });

  it('ofrece el tutorial una sola vez por usuario', () => {
    const { servicio } = montar();
    servicio.ofrecerSiEsPrimeraVez();
    expect(servicio.oferta()).toBe(true);
    servicio.marcarVisto();
    expect(servicio.oferta()).toBe(false);
    servicio.ofrecerSiEsPrimeraVez();
    expect(servicio.oferta()).toBe(false);
    expect(localStorage.getItem(CLAVE_VISTO)).toBe('1');
  });

  it('otro usuario sigue viendo la oferta', () => {
    localStorage.setItem('finanzas.tutorial.visto.otra-persona', '1');
    const { servicio } = montar();
    servicio.ofrecerSiEsPrimeraVez();
    expect(servicio.oferta()).toBe(true);
  });

  it('respeta alEntrar desactivado', () => {
    localStorage.setItem(CLAVE_AL_ENTRAR, 'false');
    const { servicio } = montar();
    expect(servicio.alEntrar()).toBe(false);
    servicio.ofrecerSiEsPrimeraVez();
    expect(servicio.oferta()).toBe(false);
  });

  it('cambiarAlEntrar persiste la preferencia', () => {
    const { servicio } = montar();
    servicio.cambiarAlEntrar(false);
    expect(servicio.alEntrar()).toBe(false);
    expect(localStorage.getItem(CLAVE_AL_ENTRAR)).toBe('false');
  });

  it('un localStorage que lanza no rompe nada y no repite la oferta en la sesión', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    const { servicio } = montar();
    expect(servicio.alEntrar()).toBe(true);
    servicio.ofrecerSiEsPrimeraVez();
    expect(servicio.oferta()).toBe(true);
    expect(() => servicio.marcarVisto()).not.toThrow();
    expect(() => servicio.cambiarAlEntrar(false)).not.toThrow();
    servicio.ofrecerSiEsPrimeraVez();
    expect(servicio.oferta()).toBe(false);
  });
});
