import { Location } from '@angular/common';
import { Provider } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { RemoteBootstrap, RUNTIME_CONFIG } from '@core/session';
import { AppStore } from '@core/state';
import { describe, expect, it, vi } from 'vitest';
import { pruebaRender } from '@app/testing/prueba-render';
import { TransportFalso } from '@app/testing/transport-falso';
import { LoginComponent } from './login';

/**
 * Specs de la pantalla de acceso (ticket 02).
 *
 * Nota sobre CSRF: la obtención del token CSRF vive en `HttpApiTransport`
 * (GET /api/v1/auth/csrf antes de cualquier petición no segura, con
 * reintentos ante `security.csrf_invalid`) y ya está cubierta en
 * `core/api/api-client.spec.ts`. En estos specs, `TransportFalso` sustituye
 * esa capa entera, así que el login llega directo a `POST /api/v1/auth/login`
 * sin paso previo de CSRF: no se puede (ni hace falta) asertarlo aquí.
 */
describe('pantalla de acceso', () => {
  const METODOS = 'GET /api/v1/auth/methods';
  const LOGIN = 'POST /api/v1/auth/login';

  interface Montado {
    fixture: ComponentFixture<LoginComponent>;
    component: LoginComponent;
    store: AppStore;
    transport: TransportFalso;
    escribir(selector: string, valor: string): void;
    pantalla(): HTMLElement;
    aviso(): string | null;
    espera(): Promise<void>;
  }

  const montar = async (transport: TransportFalso, opciones: { returnUrl?: string } = {}): Promise<Montado> => {
    const resultado = pruebaRender(LoginComponent, {
      transport,
      providers: [
        provideRouter([]) as unknown as Provider, // EnvironmentProviders no entra en el Provider[] del harness
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.prueba.test' } },
      ],
    });
    resultado.store.remoteState.set('anonymous');
    resultado.store.remoteError.set('');
    if (opciones.returnUrl !== undefined) {
      const route = TestBed.inject(ActivatedRoute);
      Object.defineProperty(route.snapshot, 'queryParamMap', {
        value: convertToParamMap({ returnUrl: opciones.returnUrl }),
        configurable: true,
      });
    }
    resultado.cambios();
    await resultado.fixture.whenStable();
    resultado.fixture.detectChanges();
    const pantalla = () => resultado.fixture.nativeElement as HTMLElement;
    const escribir = (selector: string, valor: string) => {
      const input = pantalla().querySelector<HTMLInputElement>(selector)!;
      input.value = valor;
      input.dispatchEvent(new Event('input'));
    };
    return {
      fixture: resultado.fixture,
      component: resultado.component,
      store: resultado.store,
      transport: resultado.transport,
      escribir,
      pantalla,
      aviso: () => {
        resultado.fixture.detectChanges();
        return pantalla().querySelector('p[role="alert"]')?.textContent?.trim() ?? null;
      },
      espera: async () => {
        await resultado.fixture.whenStable();
        resultado.fixture.detectChanges();
      },
    };
  };

  const escribe = (montado: Montado, usuario: string, contrasena: string) => {
    montado.escribir('input[autocomplete="username"]', usuario);
    montado.escribir('input[autocomplete="current-password"]', contrasena);
    return { userName: usuario.trim(), password: contrasena };
  };

  /**
   * jsdom no implementa navegaciones completas; si `location` no es
   * sustituible (es "unforgeable" en jsdom) el intento solo queda registrado
   * como aviso: lo que el componente hace antes del salto es lo testeado.
   */
  const silenciarNavegacionDePagina = (): void => {
    try {
      vi.spyOn(window.location, 'assign').mockImplementation(() => undefined);
    } catch {
      /* no-op */
    }
  };

  it('muestra google y el formulario con contraseña cuando el servidor los ofrece', async () => {
    const transport = new TransportFalso().responder(METODOS, { body: { google: true, password: true } });
    const montado = await montar(transport);
    await montado.espera();

    expect(montado.component.methods()).toEqual({ google: true, password: true });
    expect(montado.component.showPassword()).toBe(true);
    expect(montado.component.showGoogle()).toBe(true);
    expect(montado.pantalla().querySelector('form')).not.toBeNull();
    expect(montado.pantalla().querySelector('a.api-login')).not.toBeNull();
  });

  it('sin acceso con contraseña en el servidor, no se muestra el formulario', async () => {
    const transport = new TransportFalso().responder(METODOS, { body: { google: true, password: false } });
    const montado = await montar(transport);
    await montado.espera();

    expect(montado.component.methods()).toEqual({ google: true, password: false });
    expect(montado.component.showPassword()).toBe(false);
    expect(montado.pantalla().querySelector('form')).toBeNull();
    expect(montado.pantalla().querySelector('a.api-login')).not.toBeNull();
  });

  it('si la consulta de métodos falla, la pantalla no se rompe y la contraseña queda oculta', async () => {
    const transport = new TransportFalso().responder(METODOS, {
      error: { status: 503, code: 'system.error' },
    });
    const montado = await montar(transport);
    await montado.espera();

    expect(montado.component.methods()).toBeNull();
    expect(montado.component.showPassword()).toBe(false);
    expect(montado.component.showGoogle()).toBe(true);
  });

  it('exige usuario y contraseña antes de consultar la API', async () => {
    silenciarNavegacionDePagina();
    const transport = new TransportFalso()
      .responder(METODOS, { body: { google: true, password: true } })
      .responder(LOGIN, { body: null });
    const montado = await montar(transport);
    // campos vacíos: el propio componente valida antes de pedir la API
    montado.component.userName = '';
    montado.component.password = '';
    montado.fixture.detectChanges();

    await montado.component.loginWithPassword();
    // campos vacíos: el propio componente valida antes de pedir la API
    expect(montado.aviso()).toBe('Escribe tu usuario y tu contraseña.');
    expect(montado.component.passwordError()).toBe(montado.component.i18n.t('login.password.required'));
    expect(montado.transport.peticiones.map((p) => `${p.method} ${p.path}`)).toEqual([METODOS]);

    montado.escribir('input[autocomplete="username"]', 'lectora');
    await montado.component.loginWithPassword();
    expect(montado.aviso()).toBe('Escribe tu usuario y tu contraseña.');
    expect(montado.transport.peticiones.map((p) => `${p.method} ${p.path}`)).toEqual([METODOS]);
  });

  it('bloquea el formulario mientras la petición está en vuelo', async () => {
    silenciarNavegacionDePagina();
    const transport = new TransportFalso()
      .responder(METODOS, { body: { google: true, password: true } })
      .responder(LOGIN, { latenciaMs: 25, body: null });
    const montado = await montar(transport);
    montado.escribir('input[autocomplete="username"]', 'lectora');
    montado.escribir('input[autocomplete="current-password"]', 'secreta');

    void montado.component.loginWithPassword();
    montado.fixture.detectChanges();
    expect(montado.component.signingIn()).toBe(true);
    expect(montado.pantalla().querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);

    await new Promise((resolucion) => setTimeout(resolucion, 40));
    expect(montado.component.signingIn()).toBe(true); // el éxito no desbloquea: salta a página completa
  });

  it('manda el usuario recortado a la API y limpia la contraseña al entrar', async () => {
    silenciarNavegacionDePagina();
    const transport = new TransportFalso()
      .responder(METODOS, { body: { google: true, password: true } })
      .responder(LOGIN, { body: null });
    const montado = await montar(transport);
    escribe(montado, '  lectora  ', 'secreta');

    await montado.component.loginWithPassword();

    expect(montado.transport.peticiones.find((p) => p.path === '/api/v1/auth/login')).toMatchObject({
      method: 'POST',
      path: '/api/v1/auth/login',
      body: { userName: 'lectora', password: 'secreta' },
    });
    expect(montado.component.password).toBe('');
    expect(montado.component.passwordError()).toBe('');
  });

  it('las credenciales inválidas (401) muestran el mensaje específico y dejan reintentar', async () => {
    const transport = new TransportFalso()
      .responder(METODOS, { body: { google: true, password: true } })
      .responder(LOGIN, { error: { status: 401, code: 'authorization.invalid' } });
    const montado = await montar(transport);
    escribe(montado, 'lectora', 'clave-mal');

    await montado.component.loginWithPassword();

    expect(montado.component.passwordError()).toBe('Usuario o contraseña incorrectos.');
    expect(montado.aviso()).toBe('Usuario o contraseña incorrectos.');
    expect(montado.component.signingIn()).toBe(false);
    expect(montado.component.password).toBe('');
  });

  it('el bloqueo por intentos repetidos (429) anuncia que espere un minuto', async () => {
    const transport = new TransportFalso()
      .responder(METODOS, { body: { google: true, password: true } })
      .responder(LOGIN, { error: { status: 429, code: 'authorization.throttled' } });
    const montado = await montar(transport);
    escribe(montado, 'lectora', 'clave');

    await montado.component.loginWithPassword();

    expect(montado.component.passwordError()).toBe('Demasiados intentos. Espera un minuto y vuelve a probar.');
    expect(montado.component.signingIn()).toBe(false);
  });

  it('cuando el servidor no ofrece acceso con contraseña (404/503) lo explica', async () => {
    for (const status of [404, 503]) {
      const transport = new TransportFalso()
        .responder(METODOS, { body: { google: true, password: true } })
        .responder(LOGIN, { error: { status, code: 'system.notfound' } });
      const montado = await montar(transport);
      escribe(montado, 'lectora', 'clave');

      await montado.component.loginWithPassword();

      expect(montado.component.passwordError()).toBe('El acceso con contraseña no está disponible en este servidor.');
    }
  });

  it('cualquier otro fallo anuncia que revise la conexión', async () => {
    const transport = new TransportFalso()
      .responder(METODOS, { body: { google: true, password: true } })
      .responder(LOGIN, { error: { status: 500, code: 'system.error' } });
    const montado = await montar(transport);
    escribe(montado, 'lectora', 'clave');

    await montado.component.loginWithPassword();

    expect(montado.component.passwordError()).toBe(
      'No se pudo iniciar sesión. Revisa la conexión e inténtalo de nuevo.',
    );
  });

  it('después de entrar con éxito prepara el salto a la URL pedida, no siempre al dashboard', async () => {
    silenciarNavegacionDePagina();
    const transport = new TransportFalso()
      .responder(METODOS, { body: { google: true, password: true } })
      .responder(LOGIN, { body: null });
    const montado = await montar(transport, { returnUrl: '/movements?pagina=3' });
    escribe(montado, 'lectora', 'secreta');
    const preparar = vi.spyOn(TestBed.inject(Location), 'prepareExternalUrl');

    await montado.component.loginWithPassword();

    expect(preparar).toHaveBeenCalledWith('/movements?pagina=3');
  });

  it('sin returnUrl pedida, el salto tras entrar va al dashboard', async () => {
    silenciarNavegacionDePagina();
    const transport = new TransportFalso()
      .responder(METODOS, { body: { google: true, password: true } })
      .responder(LOGIN, { body: null });
    const montado = await montar(transport);
    escribe(montado, 'lectora', 'secreta');
    const preparar = vi.spyOn(TestBed.inject(Location), 'prepareExternalUrl');

    await montado.component.loginWithPassword();

    expect(preparar).toHaveBeenCalledWith('/dashboard');
  });

  it('el enlace de Google recuerda a dónde volver tras autenticar', async () => {
    const transport = new TransportFalso().responder(METODOS, { body: { google: true, password: true } });
    const montado = await montar(transport, { returnUrl: '/movements?pagina=3' });

    expect(montado.component.googleLoginUrl()).toBe(
      `https://api.prueba.test/api/v1/auth/google?returnUrl=${encodeURIComponent(
        `${window.location.origin}/movements?pagina=3`,
      )}`,
    );
  });

  it('una returnUrl externa o peligrosa se ignora y se vuelve al dashboard', async () => {
    const transport = new TransportFalso().responder(METODOS, { body: { google: true, password: true } });
    const montado = await montar(transport, { returnUrl: 'https://otro.example/x' });

    expect(montado.component.googleLoginUrl()).toBe(
      `https://api.prueba.test/api/v1/auth/google?returnUrl=${encodeURIComponent(
        `${window.location.origin}/dashboard`,
      )}`,
    );
  });

  it('cuando no puede conectar, la pantalla explica el fallo y "Reintentar" vuelve a arrancar', async () => {
    const transport = new TransportFalso().responder(METODOS, { body: { google: true, password: true } });
    const montado = await montar(transport);
    const inicializar = vi.spyOn(TestBed.inject(RemoteBootstrap), 'initialize').mockResolvedValue();

    montado.store.remoteState.set('error');
    montado.store.remoteError.set('No se pudo hablar con el servidor.');
    montado.fixture.detectChanges();

    const alerta = montado.pantalla().querySelector('p[role="alert"]');
    expect(alerta?.textContent).toContain('No se pudo hablar con el servidor.');
    const boton = [...montado.pantalla().querySelectorAll('button')].find((b) => b.textContent?.includes('Reintentar'));
    expect(boton).not.toBeNull();
    boton!.click();
    expect(inicializar).toHaveBeenCalledOnce();
  });
});
