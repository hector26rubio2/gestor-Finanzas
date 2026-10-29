import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceApiClient } from '@core/api';
import { RUNTIME_CONFIG } from '@core/session';
import { TutorialService } from '@shared/tutorial';
import { PreferencesTabComponent } from './preferences-tab';

function montar() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'http://api.test' } },
      { provide: FinanceApiClient, useValue: {} },
    ],
  });
  const tutorial = TestBed.inject(TutorialService);
  const iniciar = vi.spyOn(tutorial, 'iniciar').mockResolvedValue();
  const componente = TestBed.runInInjectionContext(() => new PreferencesTabComponent());
  return { componente, tutorial, iniciar };
}

describe('Preferencias: tutorial', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('la sección Tutorial está siempre disponible', () => {
    const { componente } = montar();
    expect(componente.secciones().map((seccion) => seccion.id)).toContain('tutorial');
  });

  it('el botón Ver tutorial lanza el recorrido', () => {
    const { componente, iniciar } = montar();
    componente.verTutorial();
    expect(iniciar).toHaveBeenCalledTimes(1);
  });

  it('el interruptor persiste la preferencia de ofrecerlo al entrar', () => {
    const { componente, tutorial } = montar();
    componente.ofrecerAlEntrar(false);
    expect(tutorial.alEntrar()).toBe(false);
    expect(localStorage.getItem('finanzas.tutorial.al-entrar')).toBe('false');
    componente.ofrecerAlEntrar(true);
    expect(localStorage.getItem('finanzas.tutorial.al-entrar')).toBe('true');
  });
});
