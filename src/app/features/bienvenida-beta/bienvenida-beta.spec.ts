import { beforeEach, describe, expect, it } from 'vitest';
import { P } from '@core/session';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { BienvenidaBetaComponent } from './bienvenida-beta';

function montar(capacidades: string[]) {
  const montado = pruebaRender(BienvenidaBetaComponent, {
    session: sesionDe().conCapacidad(...capacidades),
    data: datosDe(),
  });
  montado.cambios();
  return montado;
}

const aviso = (raiz: HTMLElement) => raiz.querySelector('[data-testid="bienvenida-beta"]');

describe('bienvenida para cuentas de solo lectura', () => {
  beforeEach(() => localStorage.clear());

  it('una cuenta que solo puede ver recibe la bienvenida con lo que puede hacer', () => {
    const { fixture } = montar([P.dashboard.ver, P.movimientos.ver, P.cuentas.ver]);

    const texto = aviso(fixture.nativeElement)?.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(texto).toContain('solo lectura');
    expect(texto).toContain('calendario');
  });

  it('quien puede registrar movimientos no la ve', () => {
    const { fixture } = montar([P.dashboard.ver, P.movimientos.ver, P.movimientos.crear]);

    expect(aviso(fixture.nativeElement)).toBeNull();
  });

  it('quien puede crear cuentas no la ve', () => {
    const { fixture } = montar([P.dashboard.ver, P.cuentas.crear]);

    expect(aviso(fixture.nativeElement)).toBeNull();
  });

  it('al entendido se oculta y no vuelve en la siguiente visita', () => {
    const primera = montar([P.dashboard.ver, P.movimientos.ver]);
    primera.fixture.nativeElement.querySelector('[data-testid="bienvenida-beta-cerrar"]').click();
    primera.cambios();
    expect(aviso(primera.fixture.nativeElement)).toBeNull();

    const segunda = montar([P.dashboard.ver, P.movimientos.ver]);
    expect(aviso(segunda.fixture.nativeElement)).toBeNull();
  });
});
