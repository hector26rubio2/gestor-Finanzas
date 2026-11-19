import { HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, ApiSession, FinanceApiClient } from '@core/api/api-client';
import { sesionVencidaInterceptor } from '@core/http/interceptores';
import { AppStore } from '@core/state/store';
import { arranqueDe } from '@testing/arranque-de-prueba';
import { P } from './permissions';
import { RemoteBootstrap } from './remote-bootstrap';
import { RUNTIME_CONFIG } from './runtime';

const BASE = 'https://api.example.test';

const sesion = {
  user: { id: 'u1', displayName: 'Lectora', email: 'lectora@example.test', isActive: true },
  organization: { id: 'o1', name: 'Personal', slug: 'personal', baseCurrency: 'COP', isActive: true, createdAt: '' },
  capabilities: [],
  organizations: [],
  expiresAt: '',
  permissions: [P.dashboard.ver, P.movimientos.ver],
} as unknown as ApiSession;

describe('sesión vencida: la app pide iniciar sesión y vuelve a donde estaba', () => {
  let vencida: boolean;

  async function montar(rutaActual: string) {
    vencida = false;
    const api = {
      bootstrap: vi.fn(() =>
        vencida
          ? throwError(() => new ApiRequestError(401, { status: 401, title: 'Unauthorized' }))
          : of(
              arranqueDe(sesion, {
                featureFlags: [{ key: 'movements', isEnabled: true, audienceJson: null, updatedAt: '' }],
              }),
            ),
      ),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'movements', children: [] },
          { path: 'dashboard', children: [] },
          { path: 'login', children: [] },
        ]),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: BASE } },
        { provide: FinanceApiClient, useValue: api },
      ],
    });
    const arranque = TestBed.inject(RemoteBootstrap);
    await arranque.initialize();
    await TestBed.inject(Router).navigateByUrl(rutaActual);
    return { arranque, router: TestBed.inject(Router), store: TestBed.inject(AppStore) };
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('al vencer la sesión la app deja de mostrar a la persona y la manda al acceso con la ruta de vuelta', async () => {
    const { arranque, router, store } = await montar('/movements?periodo=2026-03');

    vencida = true;
    await arranque.pollSession();

    expect(store.user()).toBeNull();
    expect(store.remoteState()).toBe('anonymous');
    const url = router.parseUrl(router.url);
    expect(url.root.children['primary'].segments.map((s) => s.path)).toEqual(['login']);
    expect(url.queryParams['returnUrl']).toBe('/movements?periodo=2026-03');
  });

  it('si ya estaba en el acceso no se pide volver a sí mismo', async () => {
    const { arranque, router } = await montar('/login');

    vencida = true;
    await arranque.pollSession();

    expect(router.parseUrl(router.url).queryParams['returnUrl']).toBeUndefined();
  });

  describe('un 401 al guardar', () => {
    const peticion = (metodo: string, ruta: string) => new HttpRequest(metodo as 'POST', `${BASE}${ruta}`, null);
    const falla = (estado: number) => () => throwError(() => new HttpErrorResponse({ status: estado }));

    async function correr(req: HttpRequest<unknown>, estado: number) {
      const { arranque } = await montar('/movements');
      const sondeo = vi.spyOn(arranque, 'pollSession').mockResolvedValue(undefined);
      await firstValueFrom(TestBed.runInInjectionContext(() => sesionVencidaInterceptor(req, falla(estado)))).catch(
        (error: unknown) => error,
      );
      return { sondeo };
    }

    it('revisa la sesión para que la app pida iniciar sesión, y el error sigue llegando al formulario', async () => {
      const { arranque } = await montar('/movements');
      const sondeo = vi.spyOn(arranque, 'pollSession').mockResolvedValue(undefined);

      const error = await firstValueFrom(
        TestBed.runInInjectionContext(() =>
          sesionVencidaInterceptor(peticion('POST', '/api/v1/movements'), falla(401)),
        ),
      ).catch((e: unknown) => e);

      expect(sondeo).toHaveBeenCalledTimes(1);
      expect(error).toBeInstanceOf(HttpErrorResponse);
      expect((error as HttpErrorResponse).status).toBe(401);
    });

    it('una lectura con 401 no dispara la revisión por su cuenta', async () => {
      const { sondeo } = await correr(peticion('GET', '/api/v1/accounts'), 401);

      expect(sondeo).not.toHaveBeenCalled();
    });

    it('un 401 al iniciar sesión es una clave mala, no una sesión vencida', async () => {
      const { sondeo } = await correr(peticion('POST', '/api/v1/auth/login'), 401);

      expect(sondeo).not.toHaveBeenCalled();
    });

    it('otros errores no cuentan como sesión vencida', async () => {
      const { sondeo } = await correr(peticion('POST', '/api/v1/movements'), 403);

      expect(sondeo).not.toHaveBeenCalled();
    });

    it('un 401 de otro servidor no toca la sesión de esta app', async () => {
      const { sondeo } = await correr(new HttpRequest('POST', 'https://otro.example.test/x', null), 401);

      expect(sondeo).not.toHaveBeenCalled();
    });
  });

  it('el interceptor resuelve RemoteBootstrap del inyector sin ciclo al construirse', async () => {
    await montar('/dashboard');

    expect(TestBed.inject(Injector).get(RemoteBootstrap)).toBeInstanceOf(RemoteBootstrap);
  });
});
