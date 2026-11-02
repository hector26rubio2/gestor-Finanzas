import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ENTORNO_INSTALACION, InstalacionPwa, detectarIos } from './instalacion.service';

interface EventoDeInstalacion extends Event {
  prompt: ReturnType<typeof vi.fn>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function eventoDeInstalacion(resultado: 'accepted' | 'dismissed' = 'accepted'): EventoDeInstalacion {
  const evento = new Event('beforeinstallprompt', { cancelable: true }) as EventoDeInstalacion;
  evento.prompt = vi.fn().mockResolvedValue(undefined);
  evento.userChoice = Promise.resolve({ outcome: resultado });
  return evento;
}

describe('instalación de la PWA', () => {
  let esIos: boolean;
  let instalada: boolean;

  const crear = () => {
    const servicio = TestBed.inject(InstalacionPwa);
    servicio.iniciar();
    return servicio;
  };

  beforeEach(() => {
    esIos = false;
    instalada = false;
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ENTORNO_INSTALACION,
          useValue: { esIos: () => esIos, esInstalada: () => instalada },
        },
      ],
    });
  });

  it('sin evento no ofrece instalar', () => {
    const servicio = crear();
    expect(servicio.puedeInstalar()).toBe(false);
    expect(servicio.instruccionIos()).toBe(false);
  });

  it('captura beforeinstallprompt y ofrece instalar', () => {
    const servicio = crear();
    const evento = eventoDeInstalacion();
    window.dispatchEvent(evento);
    expect(evento.defaultPrevented).toBe(true);
    expect(servicio.puedeInstalar()).toBe(true);
  });

  it('instalar lanza el aviso del navegador y lo consume', async () => {
    const servicio = crear();
    const evento = eventoDeInstalacion('accepted');
    window.dispatchEvent(evento);
    await servicio.instalar();
    expect(evento.prompt).toHaveBeenCalledOnce();
    expect(servicio.puedeInstalar()).toBe(false);
  });

  it('appinstalled oculta la opción', () => {
    const servicio = crear();
    window.dispatchEvent(eventoDeInstalacion());
    window.dispatchEvent(new Event('appinstalled'));
    expect(servicio.puedeInstalar()).toBe(false);
  });

  it('en iOS sin instalar muestra la instrucción de Compartir', () => {
    esIos = true;
    const servicio = crear();
    expect(servicio.instruccionIos()).toBe(true);
    expect(servicio.puedeInstalar()).toBe(false);
  });

  it('en iOS ya instalada no muestra nada', () => {
    esIos = true;
    instalada = true;
    const servicio = crear();
    expect(servicio.instruccionIos()).toBe(false);
  });

  it('ya instalada ignora beforeinstallprompt', () => {
    instalada = true;
    const servicio = crear();
    window.dispatchEvent(eventoDeInstalacion());
    expect(servicio.puedeInstalar()).toBe(false);
  });

  it('detecta iPhone, iPad y iPadOS que se anuncia como Mac', () => {
    expect(detectarIos({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', maxTouchPoints: 5 })).toBe(true);
    expect(detectarIos({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0)', maxTouchPoints: 5 })).toBe(true);
    expect(detectarIos({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', maxTouchPoints: 5 })).toBe(true);
    expect(detectarIos({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', maxTouchPoints: 0 })).toBe(false);
    expect(detectarIos({ userAgent: 'Mozilla/5.0 (Linux; Android 14)', maxTouchPoints: 5 })).toBe(false);
  });
});
